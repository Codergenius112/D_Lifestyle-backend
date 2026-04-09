import {
  Controller, Post, Headers, HttpCode,
  BadRequestException, Logger, Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTransaction } from '../../shared/entities/payment.entity';
import { Booking } from '../../shared/entities/booking.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { FinancialLedger } from '../../shared/entities/financial-ledger.entity';
import { PaymentStatus, BookingStatus } from '../../shared/enums';

@ApiTags('Payments - Webhook')
@Controller('payments')
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private paymentRepo: Repository<PaymentTransaction>,
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,
    @InjectRepository(FinancialLedger)
    private ledgerRepo: Repository<FinancialLedger>,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // 1. Reject immediately if signature header is missing
    if (!signature) {
      this.logger.warn('Webhook rejected: missing signature header');
      throw new BadRequestException('Missing signature');
    }

    // 2. Ensure body is a raw Buffer
    if (!Buffer.isBuffer(req.body)) {
      this.logger.error('Webhook rejected: raw body middleware not configured correctly');
      throw new BadRequestException('Invalid body format');
    }

    // 3. Verify HMAC-SHA512 signature
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      this.logger.error('PAYSTACK_SECRET_KEY is not set in environment');
      throw new BadRequestException('Webhook misconfigured');
    }

    const rawBody = req.body.toString('utf8');
    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    const hashBuffer      = Buffer.from(hash, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    const signaturesMatch =
      hashBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(hashBuffer, signatureBuffer);

    if (!signaturesMatch) {
      this.logger.warn('Webhook rejected: signature mismatch');
      throw new BadRequestException('Invalid signature');
    }

    // 4. Parse body only after signature is verified
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      this.logger.error('Webhook rejected: invalid JSON body');
      throw new BadRequestException('Malformed payload');
    }

    const event = payload?.event;
    const data  = payload?.data;

    if (!event || !data) {
      this.logger.warn('Webhook rejected: missing event or data fields');
      throw new BadRequestException('Invalid payload structure');
    }

    this.logger.log(`Paystack webhook received: ${event}`);

    // 5. Route to handler
    switch (event) {
      case 'charge.success':
        await this.handleChargeSuccess(data);
        break;

      case 'transfer.success':
        await this.handleTransferSuccess(data);
        break;

      default:
        this.logger.log(`Unhandled webhook event ignored: ${event}`);
    }

    return { received: true };
  }

  private async handleChargeSuccess(data: any): Promise<void> {
    const reference  = data?.reference;
    const amountKobo = data?.amount;

    if (!reference || typeof reference !== 'string') {
      this.logger.warn('charge.success: missing or invalid reference');
      return;
    }

    if (!amountKobo || typeof amountKobo !== 'number') {
      this.logger.warn('charge.success: missing or invalid amount');
      return;
    }

    const amountNaira = amountKobo / 100;

    const payment = await this.paymentRepo.findOne({
      where: { externalRefId: reference },
    });

    if (!payment) {
      this.logger.warn(`charge.success: no payment record found for ref: ${reference}`);
      return;
    }

    if (payment.status === PaymentStatus.FULLY_PAID) {
      this.logger.log(`charge.success: payment ${reference} already confirmed — skipping`);
      return;
    }

    if (Number(payment.amount) !== amountNaira) {
      this.logger.warn(
        `charge.success: amount mismatch for ref ${reference} — ` +
        `expected ₦${payment.amount}, got ₦${amountNaira}`
      );
    }

    payment.status      = PaymentStatus.FULLY_PAID;
    payment.completedAt = new Date();
    await this.paymentRepo.save(payment);

    const booking = await this.bookingRepo.findOne({
      where: { id: payment.bookingId },
    });

    if (!booking) {
      this.logger.warn(`charge.success: no booking found for payment ${reference}`);
      return;
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      this.logger.log(`charge.success: booking ${booking.id} already confirmed — skipping`);
      return;
    }

    booking.paymentStatus = PaymentStatus.FULLY_PAID;
    booking.status        = BookingStatus.CONFIRMED;
    booking.paymentMethod = 'paystack';
    await this.bookingRepo.save(booking);

    this.logger.log(`Booking ${booking.id} confirmed via webhook — ₦${amountNaira}`);
  }

  private async handleTransferSuccess(data: any): Promise<void> {
    const reference  = data?.reference;
    const amountKobo = data?.amount;

    // Validate required fields
    if (!reference || typeof reference !== 'string') {
      this.logger.warn('transfer.success: missing or invalid reference');
      return;
    }

    if (!amountKobo || typeof amountKobo !== 'number') {
      this.logger.warn('transfer.success: missing or invalid amount');
      return;
    }

    // Only process wallet top-up references
    if (!reference.startsWith('wallet-topup-')) {
      this.logger.log(`transfer.success: ignoring non-wallet-topup reference: ${reference}`);
      return;
    }

    // Reference format: wallet-topup-{userId}-{timestamp}
    const parts  = reference.split('-');
    const userId = parts[2];

    if (!userId) {
      this.logger.warn(`transfer.success: could not extract userId from reference: ${reference}`);
      return;
    }

    const amountNaira = amountKobo / 100;

    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      this.logger.warn(`transfer.success: no wallet found for user ${userId}`);
      return;
    }

    // Idempotency guard — check if this reference was already processed
    const alreadyProcessed = await this.ledgerRepo.findOne({
      where: { description: `Wallet top-up via Paystack (ref: ${reference})` },
    });

    if (alreadyProcessed) {
      this.logger.log(`transfer.success: reference ${reference} already processed — skipping`);
      return;
    }

    // Credit the wallet
    wallet.balance           = Number(wallet.balance) + amountNaira;
    wallet.lastTransactionAt = new Date();
    await this.walletRepo.save(wallet);

    // Create ledger entry
    const ledger = this.ledgerRepo.create({
      relatedUserId:   userId,
      transactionType: 'CREDIT',
      amount:          amountNaira,
      description:     `Wallet top-up via Paystack (ref: ${reference})`,
    });
    await this.ledgerRepo.save(ledger);

    this.logger.log(`Wallet credited ₦${amountNaira} for user ${userId} (ref: ${reference})`);
  }
}
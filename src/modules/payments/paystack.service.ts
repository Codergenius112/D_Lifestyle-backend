import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

// ─── Response shapes ──────────────────────────────────────────────────────────
export interface PaystackInitResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackVerifyResponse {
  status: 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending';
  reference: string;
  amountNaira: number;
  currency: string;
  paidAt: string | null;
  customerEmail: string;
  channel: string;
}

export interface PaystackBankListItem {
  name: string;
  code: string;
}

export interface PaystackResolveAccountResponse {
  accountName: string;
  accountNumber: string;
}

export interface PaystackTransferRecipientResponse {
  recipientCode: string;
}

export interface PaystackTransferResponse {
  transferCode: string;
  reference: string;
  status: string;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly client: AxiosInstance;
  private readonly secretKey: string;

  constructor() {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      throw new InternalServerErrorException(
        'PAYSTACK_SECRET_KEY is not set in environment variables.',
      );
    }

    this.secretKey = secret;

    this.client = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  // ─── 1. Initialize a transaction (Paystack Popup / Redirect) ──────────────
  // Call this before showing the Paystack payment sheet on mobile.
  // Returns the authorization URL and a reference to track the payment.
  async initializeTransaction(
    email: string,
    amountNaira: number,
    reference: string,
    metadata?: Record<string, any>,
  ): Promise<PaystackInitResponse> {
    if (amountNaira <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    try {
      const { data } = await this.client.post('/transaction/initialize', {
        email,
        amount: Math.round(amountNaira * 100), // Paystack works in kobo
        reference,
        currency: 'NGN',
        metadata: metadata ?? {},
      });

      if (!data.status) {
        throw new BadRequestException(data.message || 'Paystack initialization failed');
      }

      return {
        authorizationUrl: data.data.authorization_url,
        accessCode:       data.data.access_code,
        reference:        data.data.reference,
      };
    } catch (err: any) {
      this.logger.error('Paystack initializeTransaction failed', err?.response?.data ?? err.message);
      throw new BadRequestException(
        err?.response?.data?.message ?? 'Failed to initialize Paystack transaction',
      );
    }
  }

  // ─── 2. Verify a transaction ───────────────────────────────────────────────
  // Call this server-side after mobile confirms payment to double-check
  // with Paystack before crediting wallet or confirming booking.
  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    if (!reference) {
      throw new BadRequestException('Reference is required');
    }

    try {
      const { data } = await this.client.get(
        `/transaction/verify/${encodeURIComponent(reference)}`,
      );

      if (!data.status) {
        throw new BadRequestException(data.message || 'Paystack verification failed');
      }

      const tx = data.data;

      return {
        status:        tx.status,
        reference:     tx.reference,
        amountNaira:   tx.amount / 100,
        currency:      tx.currency,
        paidAt:        tx.paid_at ?? null,
        customerEmail: tx.customer?.email ?? '',
        channel:       tx.channel ?? '',
      };
    } catch (err: any) {
      this.logger.error('Paystack verifyTransaction failed', err?.response?.data ?? err.message);
      throw new BadRequestException(
        err?.response?.data?.message ?? 'Failed to verify Paystack transaction',
      );
    }
  }

  // ─── 3. List banks (for withdrawal/payout setup) ──────────────────────────
  async listBanks(): Promise<PaystackBankListItem[]> {
    try {
      const { data } = await this.client.get('/bank?currency=NGN&perPage=100');

      return (data.data as any[]).map((b) => ({
        name: b.name,
        code: b.code,
      }));
    } catch (err: any) {
      this.logger.error('Paystack listBanks failed', err?.response?.data ?? err.message);
      throw new InternalServerErrorException('Failed to fetch bank list from Paystack');
    }
  }

  // ─── 4. Resolve bank account (verify account number before payout) ────────
  async resolveAccountNumber(
    accountNumber: string,
    bankCode: string,
  ): Promise<PaystackResolveAccountResponse> {
    try {
      const { data } = await this.client.get(
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      );

      if (!data.status) {
        throw new BadRequestException(data.message || 'Could not resolve account');
      }

      return {
        accountName:   data.data.account_name,
        accountNumber: data.data.account_number,
      };
    } catch (err: any) {
      this.logger.error('Paystack resolveAccountNumber failed', err?.response?.data ?? err.message);
      throw new BadRequestException(
        err?.response?.data?.message ?? 'Failed to resolve bank account',
      );
    }
  }

  // ─── 5. Create transfer recipient (required before payout) ────────────────
  async createTransferRecipient(
    name: string,
    accountNumber: string,
    bankCode: string,
  ): Promise<PaystackTransferRecipientResponse> {
    try {
      const { data } = await this.client.post('/transferrecipient', {
        type:           'nuban',
        name,
        account_number: accountNumber,
        bank_code:      bankCode,
        currency:       'NGN',
      });

      if (!data.status) {
        throw new BadRequestException(data.message || 'Could not create transfer recipient');
      }

      return {
        recipientCode: data.data.recipient_code,
      };
    } catch (err: any) {
      this.logger.error('Paystack createTransferRecipient failed', err?.response?.data ?? err.message);
      throw new BadRequestException(
        err?.response?.data?.message ?? 'Failed to create transfer recipient',
      );
    }
  }

  // ─── 6. Initiate transfer / payout ────────────────────────────────────────
  // Used when a user withdraws from their D-Lifestyle wallet to their bank.
  async initiateTransfer(
    amountNaira: number,
    recipientCode: string,
    reference: string,
    reason: string,
  ): Promise<PaystackTransferResponse> {
    if (amountNaira <= 0) {
      throw new BadRequestException('Transfer amount must be greater than 0');
    }

    try {
      const { data } = await this.client.post('/transfer', {
        source:    'balance',
        amount:    Math.round(amountNaira * 100), // kobo
        recipient: recipientCode,
        reference,
        reason,
      });

      if (!data.status) {
        throw new BadRequestException(data.message || 'Transfer initiation failed');
      }

      return {
        transferCode: data.data.transfer_code,
        reference:    data.data.reference,
        status:       data.data.status,
      };
    } catch (err: any) {
      this.logger.error('Paystack initiateTransfer failed', err?.response?.data ?? err.message);
      throw new BadRequestException(
        err?.response?.data?.message ?? 'Failed to initiate Paystack transfer',
      );
    }
  }
}
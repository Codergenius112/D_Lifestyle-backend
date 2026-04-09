import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ── Raw body ONLY for Paystack webhook — must come before json middleware ──
  // express.raw() captures the body as a Buffer, which is required for
  // HMAC-SHA512 signature verification in PaystackWebhookController.
  app.use('/payments/webhook', express.raw({ type: 'application/json' }));

  // ── Security middleware ────────────────────────────────────────────────────
  app.use(helmet());
  app.enableCors({
    origin:      process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

  // ── Global validation pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
    }),
  );

  // ── Swagger documentation ──────────────────────────────────────────────────
  if (process.env.ENABLE_SWAGGER !== 'false') {
    const config = new DocumentBuilder()
      .setTitle("D'Lifestyle API")
      .setDescription("Production-ready API for D'Lifestyle platform")
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Auth')
      .addTag('Bookings')
      .addTag('Payments')
      .addTag('Orders')
      .addTag('Notifications')
      .addTag('Admin')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(` D'Lifestyle Backend running on -- http://localhost:${port}`);
  console.log(` API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
  process.exit(1);
});
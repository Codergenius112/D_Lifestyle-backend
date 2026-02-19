import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import { User } from '../shared/entities/user.entity';
import { Booking } from '../shared/entities/booking.entity';
import { PaymentTransaction } from '../shared/entities/payment.entity';
import { Wallet } from '../shared/entities/wallet.entity';
import { Order } from '../shared/entities/order.entity';
import { AuditLog } from '../shared/entities/audit-log.entity';
import { FinancialLedger } from '../shared/entities/financial-ledger.entity';
import { Queue } from '../shared/entities/queue.entity';
import { GroupBooking } from '../shared/entities/group-booking.entity';
import { join } from 'path';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432'),
  username: process.env.DATABASE_USER || 'dlifestyle',
  password: process.env.DATABASE_PASSWORD || '9904DTao!',
  database: process.env.DATABASE_NAME || 'dlifestyle_db',
  entities: [
    User,
    Booking,
    PaymentTransaction,
    Wallet,
    Order,
    AuditLog,
    FinancialLedger,
    Queue,
    GroupBooking,
  ],
  migrations: [join(__dirname, '../database/migrations/*.{ts,js}')],
  synchronize: false, // Use migrations instead
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DATABASE_SSL === 'true',
};

export const AppDataSource = new DataSource(dataSourceOptions);

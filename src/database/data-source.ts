import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User }               from '../shared/entities/user.entity';
import { Booking }            from '../shared/entities/booking.entity';
import { PaymentTransaction } from '../shared/entities/payment.entity';
import { Wallet }             from '../shared/entities/wallet.entity';
import { Order }              from '../shared/entities/order.entity';
import { AuditLog }           from '../shared/entities/audit-log.entity';
import { FinancialLedger }    from '../shared/entities/financial-ledger.entity';
import { Queue }              from '../shared/entities/queue.entity';
import { GroupBooking }       from '../shared/entities/group-booking.entity';
import { ApartmentListing }   from '../shared/entities/apartment-listing.entity';
import { CarListing }         from '../shared/entities/car-listing.entity';
import { TableListing }       from '../shared/entities/table-listing.entity';
import { MenuItem }           from '../shared/entities/menu-item.entity';
import { Event }              from '../shared/entities/event.entity';
import { DeviceToken }        from '../shared/entities/device-token.entity';

// ─── Validate required env vars on startup ───────────────────────────────────
const requiredEnvVars = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Make sure your .env file is present and loaded.`,
    );
  }
}

// ─── Data Source Options ──────────────────────────────────────────────────────
export const dataSourceOptions: DataSourceOptions = {
  type:     'postgres',
  host:     process.env.DATABASE_HOST,
  port:     parseInt(process.env.DATABASE_PORT ?? '5432'),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,

  entities: [
    User, Booking, PaymentTransaction, Wallet, Order,
    AuditLog, FinancialLedger, Queue, GroupBooking,
    ApartmentListing, CarListing,
    TableListing,
    MenuItem,
    Event,
    DeviceToken,
  ],

  migrations: [__dirname + '/migrations/*{.ts,.js}'],

  // ⚠️  NEVER set synchronize: true in production.
  // It can auto-drop columns and destroy data.
  // Always use migrations: npm run db:migrate
  synchronize: false,

  migrationsRun: false, // run manually via: npm run db:migrate

  logging: process.env.NODE_ENV === 'development',

  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
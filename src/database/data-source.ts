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

export const dataSourceOptions: DataSourceOptions = {
  type:     'postgres',
  host:     process.env.DATABASE_HOST     || 'localhost',
  port:     parseInt(process.env.DATABASE_PORT ?? '5432'),
  username: process.env.DATABASE_USER     || 'dlifestyle',
  password: process.env.DATABASE_PASSWORD || '9904DTao!',
  database: process.env.DATABASE_NAME     || 'dlifestyle_db',
  entities: [
    User, Booking, PaymentTransaction, Wallet, Order,
    AuditLog, FinancialLedger, Queue, GroupBooking,
    ApartmentListing, CarListing,
    TableListing,  
    MenuItem,
    Event,
    DeviceToken,  
  ],
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
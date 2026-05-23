-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL DEFAULT 'customer',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table (polymorphic)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type VARCHAR(50) NOT NULL, -- 'ticket', 'table', 'apartment', 'car'
  user_id UUID NOT NULL REFERENCES users(id),
  group_id UUID,
  resource_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
  guest_count INTEGER,
  base_price DECIMAL(12, 2),
  platform_commission DECIMAL(12, 2),
  service_charge DECIMAL(12, 2),
  total_amount DECIMAL(12, 2),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
  payment_method VARCHAR(50),
  check_in_time TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  user_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  payment_method VARCHAR(50),
  external_ref_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- User wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  balance DECIMAL(12, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'NGN',
  last_transaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs (append-only)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(100) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(50),
  resource_type VARCHAR(100),
  resource_id UUID,
  changes JSONB,
  ip_address VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial ledger (immutable)
CREATE TABLE financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  transaction_type VARCHAR(20) NOT NULL, -- 'DEBIT', 'CREDIT'
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  description TEXT,
  related_user_id UUID REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_booking_type ON bookings(booking_type);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_payment_transactions_booking_id ON payment_transactions(booking_id);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_financial_ledger_booking_id ON financial_ledger(booking_id);
CREATE INDEX idx_financial_ledger_timestamp ON financial_ledger(timestamp);

-- Create audit log insert function (PostgreSQL trigger)
CREATE OR REPLACE FUNCTION prevent_audit_deletion()
RETURNS TRIGGER AS $
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be deleted';
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_log_deletion
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_deletion();

CREATE TRIGGER prevent_ledger_deletion
BEFORE DELETE ON financial_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_deletion();

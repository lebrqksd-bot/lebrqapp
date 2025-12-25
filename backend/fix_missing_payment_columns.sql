-- Manual patch for MySQL payments table missing columns
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NULL,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS details JSON NULL,
  ADD COLUMN IF NOT EXISTS gateway_response JSON NULL;

-- Validate
SHOW COLUMNS FROM payments;
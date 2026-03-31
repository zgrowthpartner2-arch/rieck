-- ============================================
-- SCHEMA UPDATE V6 - MP Checkout, Deposits, Gifts, Modifications
-- ============================================

-- 1. Deposit / partial payment config
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS deposit_percent INT DEFAULT 100;
-- 100 = pago total obligatorio, 50 = 50% de seña, etc.

-- 2. Reservation enhancements
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS amount_remaining NUMERIC(10,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'full' CHECK (payment_type IN ('full', 'deposit'));
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS mp_preference_id TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS mp_init_point TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gifted_to_name TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gifted_to_phone TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gifted_to_email TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT FALSE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS original_date DATE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS modification_count INT DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS affiliate_code_used TEXT;

-- 3. Max modifications config
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS max_modifications INT DEFAULT 2;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS modification_deadline_hours INT DEFAULT 48;
-- Can't modify within 48hs of the event

-- Disable RLS for testing
ALTER TABLE reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

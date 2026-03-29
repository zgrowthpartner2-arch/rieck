-- ============================================
-- SCHEMA UPDATE V5 - Generic packages, discount packs, transport, schedules
-- Safe to run on any state of the DB
-- ============================================

-- 0. ENSURE V3/V4 columns exist first (idempotent)
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS glow_includes JSONB DEFAULT '[]';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS black_includes JSONB DEFAULT '[]';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS glow_open_time TEXT DEFAULT '10:00';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS glow_close_time TEXT DEFAULT '17:00';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS black_open_time TEXT DEFAULT '16:00';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS black_close_time TEXT DEFAULT '23:00';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS day_pricing JSONB DEFAULT '{}';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS dynamic_pricing_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS dynamic_pricing_tiers JSONB DEFAULT '[]';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS disabled_dates JSONB DEFAULT '[]';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS enabled_extra_dates JSONB DEFAULT '[]';

ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS custom_glow_price NUMERIC(10,2);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS custom_black_price NUMERIC(10,2);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS storefront_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS coupon_type TEXT DEFAULT 'discount';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_people INT DEFAULT 0;

-- 1. PACKAGES table
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  public_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  includes JSONB DEFAULT '[]',
  default_open_time TEXT DEFAULT '10:00',
  default_close_time TEXT DEFAULT '17:00',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate Glow Days from site_config (safe - uses DO block to read columns)
DO $$
DECLARE
  v_glow_price NUMERIC;
  v_black_price NUMERIC;
  v_glow_inc JSONB;
  v_black_inc JSONB;
  v_glow_open TEXT;
  v_glow_close TEXT;
  v_black_open TEXT;
  v_black_close TEXT;
BEGIN
  -- Only migrate if packages table is empty
  IF NOT EXISTS (SELECT 1 FROM packages) THEN
    SELECT 
      COALESCE(glow_price, 85000),
      COALESCE(black_price, 120000),
      COALESCE(glow_includes, '[]'::jsonb),
      COALESCE(black_includes, '[]'::jsonb),
      COALESCE(glow_open_time, '10:00'),
      COALESCE(glow_close_time, '17:00'),
      COALESCE(black_open_time, '16:00'),
      COALESCE(black_close_time, '23:00')
    INTO v_glow_price, v_black_price, v_glow_inc, v_black_inc, v_glow_open, v_glow_close, v_black_open, v_black_close
    FROM site_config WHERE id = 1;

    INSERT INTO packages (slug, name, description, cost_price, public_price, includes, default_open_time, default_close_time, sort_order)
    VALUES 
      ('glow_days', 'Glow Days', 'Naturaleza, pileta y relax', ROUND(v_glow_price * 0.7, 2), v_glow_price, v_glow_inc, v_glow_open, v_glow_close, 1),
      ('black_nights', 'Black Nights', 'Coctelería, cena show y música', ROUND(v_black_price * 0.7, 2), v_black_price, v_black_inc, v_black_open, v_black_close, 2);
  END IF;
END $$;

-- 2. PACKAGE SCHEDULES (per day-of-week overrides)
CREATE TABLE IF NOT EXISTS package_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TEXT,
  close_time TEXT,
  is_closed BOOLEAN DEFAULT FALSE,
  UNIQUE(package_id, day_of_week)
);

-- 3. DISCOUNT PACKS
CREATE TABLE IF NOT EXISTS discount_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
  people_count INT NOT NULL DEFAULT 2,
  total_price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TRANSPORT OPTIONS in extras
ALTER TABLE extras ADD COLUMN IF NOT EXISTS extra_type TEXT DEFAULT 'standard';
ALTER TABLE extras ADD COLUMN IF NOT EXISTS transport_direction TEXT;

INSERT INTO extras (key, name, price, sort_order, extra_type, transport_direction, active)
VALUES 
  ('transport_ida', 'Transporte — Solo ida', 0, 100, 'transport', 'ida', false),
  ('transport_vuelta', 'Transporte — Solo vuelta', 0, 101, 'transport', 'vuelta', false),
  ('transport_ida_vuelta', 'Transporte — Ida y vuelta', 0, 102, 'transport', 'ida_vuelta', false)
ON CONFLICT (key) DO NOTHING;

-- 5. MIN ANTICIPATION
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS min_anticipation_hours INT DEFAULT 48;

-- 6. DATE SCHEDULE OVERRIDES
CREATE TABLE IF NOT EXISTS date_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  open_time TEXT,
  close_time TEXT,
  is_closed BOOLEAN DEFAULT FALSE,
  UNIQUE(package_id, date)
);

-- 7. DISABLE RLS for testing
ALTER TABLE packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE discount_packs DISABLE ROW LEVEL SECURITY;
ALTER TABLE date_schedule_overrides DISABLE ROW LEVEL SECURITY;

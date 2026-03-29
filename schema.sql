-- ============================================================
-- RIECK GLOW DAYS - FULL SaaS SCHEMA
-- Supabase PostgreSQL - Run in SQL Editor
-- ============================================================

-- =====================
-- 1. USERS
-- =====================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('admin', 'afiliado', 'cliente')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_auth ON users(auth_id);

-- Auto-create user on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO users (auth_id, email, name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''), 'cliente');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================
-- 2. AFFILIATES (multinivel)
-- =====================
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  parent_affiliate_id UUID REFERENCES affiliates(id),
  affiliate_code TEXT NOT NULL UNIQUE,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  is_active BOOLEAN DEFAULT TRUE,
  total_earned NUMERIC(12,2) DEFAULT 0,
  total_referrals INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_affiliates_user ON affiliates(user_id);
CREATE INDEX idx_affiliates_parent ON affiliates(parent_affiliate_id);
CREATE INDEX idx_affiliates_code ON affiliates(affiliate_code);

-- Prevent self-referral
ALTER TABLE affiliates ADD CONSTRAINT no_self_referral 
  CHECK (parent_affiliate_id != id);

-- =====================
-- 3. COMMISSION LEVELS (admin-editable)
-- =====================
CREATE TABLE commission_levels (
  level INT PRIMARY KEY CHECK (level >= 1 AND level <= 5),
  percentage NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO commission_levels (level, percentage) VALUES
  (1, 10.00), (2, 5.00), (3, 3.00), (4, 2.00), (5, 1.00);

-- =====================
-- 4. SITE CONFIG
-- =====================
CREATE TABLE site_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  glow_price NUMERIC(10,2) DEFAULT 85000,
  black_price NUMERIC(10,2) DEFAULT 120000,
  max_capacity INT DEFAULT 60,
  all_inclusive_discount NUMERIC(10,2) DEFAULT 0,
  weekday_discount NUMERIC(10,2) DEFAULT 0,
  weekend_surcharge NUMERIC(10,2) DEFAULT 0,
  promo_enabled BOOLEAN DEFAULT TRUE,
  promo_title TEXT DEFAULT 'Promo Amigas',
  promo_subtitle TEXT DEFAULT 'Vienen 4 y pagan 3',
  promo_description TEXT DEFAULT 'Incluye almuerzo, merienda, masajes, lockers y uso del spa todo el día.',
  mp_public_key TEXT DEFAULT '',
  mp_access_token TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_config DEFAULT VALUES;

-- =====================
-- 5. EXTRAS (add-ons)
-- =====================
CREATE TABLE extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

INSERT INTO extras (key, name, price, sort_order) VALUES
  ('towel', 'Servicio de toalla y bata', 5000, 1),
  ('dessert', '1 plato de postre', 4000, 2),
  ('drink', '1 Coctel, copa de champagne o vino a elección', 6000, 3),
  ('locker', 'Locker privado', 3000, 4),
  ('picada', '1 tabla de picada individual', 7000, 5),
  ('massage', 'Masaje premium con piedras calientes', 12000, 6);

-- =====================
-- 6. SPECIAL EVENTS
-- =====================
CREATE TABLE special_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  date DATE NOT NULL,
  experience TEXT CHECK (experience IN ('glow_days', 'black_nights', 'both')) DEFAULT 'both',
  price_override NUMERIC(10,2),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_special_events_date ON special_events(date);

-- =====================
-- 7. RESERVATIONS
-- =====================
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id),
  experience TEXT NOT NULL CHECK (experience IN ('glow_days', 'black_nights')),
  date DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'acompanado', 'grupo')),
  all_inclusive BOOLEAN DEFAULT FALSE,
  extras TEXT[] DEFAULT '{}',
  price_per_person NUMERIC(10,2) NOT NULL,
  extras_total NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'completed', 'refunded')),
  affiliate_id UUID REFERENCES affiliates(id),
  coupon_code TEXT,
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  user_email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_code ON reservations(code);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_affiliate ON reservations(affiliate_id);

-- =====================
-- 8. PAYMENTS (Mercado Pago)
-- =====================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  mp_payment_id TEXT UNIQUE,
  mp_preference_id TEXT,
  mp_status TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  payment_method TEXT,
  payer_email TEXT,
  raw_webhook JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_reservation ON payments(reservation_id);
CREATE INDEX idx_payments_mp ON payments(mp_payment_id);

-- =====================
-- 9. COMMISSIONS
-- =====================
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  reservation_id UUID NOT NULL REFERENCES reservations(id),
  payment_id UUID REFERENCES payments(id),
  level INT NOT NULL CHECK (level >= 1 AND level <= 5),
  percentage NUMERIC(5,2) NOT NULL,
  base_amount NUMERIC(10,2) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_commissions_affiliate ON commissions(affiliate_id);
CREATE INDEX idx_commissions_reservation ON commissions(reservation_id);
CREATE INDEX idx_commissions_status ON commissions(status);

-- Prevent duplicate commissions
CREATE UNIQUE INDEX idx_unique_commission 
  ON commissions(affiliate_id, reservation_id, level);

-- =====================
-- 10. COUPONS
-- =====================
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INT DEFAULT 0,
  used_count INT DEFAULT 0,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 11. NEWS (admin-managed)
-- =====================
CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  published BOOLEAN DEFAULT FALSE,
  author_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_published ON news(published, created_at DESC);

-- =====================
-- 12. AUDIT LOG
-- =====================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- =====================
-- FUNCTIONS
-- =====================

-- Generate reservation code
CREATE OR REPLACE FUNCTION generate_reservation_code()
RETURNS TEXT AS $$
DECLARE new_code TEXT; exists_flag BOOLEAN;
BEGIN
  LOOP
    new_code := 'RGD-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
    SELECT EXISTS(SELECT 1 FROM reservations WHERE code = new_code) INTO exists_flag;
    EXIT WHEN NOT exists_flag;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Generate affiliate code
CREATE OR REPLACE FUNCTION generate_affiliate_code(user_name TEXT)
RETURNS TEXT AS $$
DECLARE new_code TEXT; exists_flag BOOLEAN;
BEGIN
  LOOP
    new_code := UPPER(SUBSTR(REGEXP_REPLACE(user_name, '[^a-zA-Z]', '', 'g'), 1, 4)) || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4));
    SELECT EXISTS(SELECT 1 FROM affiliates WHERE affiliate_code = new_code) INTO exists_flag;
    EXIT WHEN NOT exists_flag;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Calculate commissions for a paid reservation (5 levels)
CREATE OR REPLACE FUNCTION calculate_commissions(
  p_reservation_id UUID,
  p_payment_id UUID,
  p_amount NUMERIC
) RETURNS INT AS $$
DECLARE
  v_affiliate_id UUID;
  v_current_id UUID;
  v_level INT := 0;
  v_percentage NUMERIC;
  v_commission NUMERIC;
  v_total_created INT := 0;
  v_is_active BOOLEAN;
  v_level_active BOOLEAN;
BEGIN
  -- Get the affiliate who generated this reservation
  SELECT affiliate_id INTO v_affiliate_id 
  FROM reservations WHERE id = p_reservation_id;
  
  IF v_affiliate_id IS NULL THEN RETURN 0; END IF;
  
  v_current_id := v_affiliate_id;
  
  -- Walk up the chain (max 5 levels)
  WHILE v_current_id IS NOT NULL AND v_level < 5 LOOP
    v_level := v_level + 1;
    
    -- Check if affiliate is active
    SELECT is_active INTO v_is_active FROM affiliates WHERE id = v_current_id;
    IF NOT v_is_active THEN
      -- Skip inactive, continue to parent
      SELECT parent_affiliate_id INTO v_current_id FROM affiliates WHERE id = v_current_id;
      CONTINUE;
    END IF;
    
    -- Check if this commission level is active
    SELECT percentage, is_active INTO v_percentage, v_level_active 
    FROM commission_levels WHERE level = v_level;
    
    IF v_level_active AND v_percentage > 0 THEN
      v_commission := ROUND(p_amount * v_percentage / 100, 2);
      
      -- Insert commission (skip if duplicate)
      INSERT INTO commissions (affiliate_id, reservation_id, payment_id, level, percentage, base_amount, amount, status)
      VALUES (v_current_id, p_reservation_id, p_payment_id, v_level, v_percentage, p_amount, v_commission, 'approved')
      ON CONFLICT (affiliate_id, reservation_id, level) DO NOTHING;
      
      -- Update affiliate total
      UPDATE affiliates SET total_earned = total_earned + v_commission WHERE id = v_current_id;
      
      v_total_created := v_total_created + 1;
    END IF;
    
    -- Move to parent
    SELECT parent_affiliate_id INTO v_current_id FROM affiliates WHERE id = v_current_id;
  END LOOP;
  
  RETURN v_total_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Universal insert policy (for triggers)
CREATE POLICY "allow_insert_users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_insert_reservations" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_insert_payments" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_insert_commissions" ON commissions FOR INSERT WITH CHECK (true);

-- Users
CREATE POLICY "users_select_own" ON users FOR SELECT USING (
  auth_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth_id = auth.uid());
CREATE POLICY "admin_all_users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);

-- Affiliates
CREATE POLICY "affiliates_select" ON affiliates FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_affiliates" ON affiliates FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);

-- Reservations
CREATE POLICY "reservations_select" ON reservations FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_reservations" ON reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);

-- Payments
CREATE POLICY "payments_select" ON payments FOR SELECT USING (
  reservation_id IN (SELECT id FROM reservations WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_payments" ON payments FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);

-- Commissions
CREATE POLICY "commissions_select" ON commissions FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_all_commissions" ON commissions FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);

-- Public reads
CREATE POLICY "public_read_config" ON site_config FOR SELECT USING (true);
CREATE POLICY "admin_update_config" ON site_config FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "public_read_extras" ON extras FOR SELECT USING (true);
CREATE POLICY "admin_all_extras" ON extras FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "public_read_events" ON special_events FOR SELECT USING (active = true);
CREATE POLICY "admin_all_events" ON special_events FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "public_read_coupons" ON coupons FOR SELECT USING (active = true);
CREATE POLICY "admin_all_coupons" ON coupons FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "public_read_levels" ON commission_levels FOR SELECT USING (true);
CREATE POLICY "admin_update_levels" ON commission_levels FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "public_read_news" ON news FOR SELECT USING (published = true);
CREATE POLICY "admin_all_news" ON news FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_audit" ON audit_log FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- SCHEMA UPDATE V3 - Day pricing, dynamic pricing, base packages, 2x1 coupons
-- Run AFTER the main schema.sql
-- ============================================

-- Day-specific pricing (replace single weekday/weekend with per-day)
ALTER TABLE site_config DROP COLUMN IF EXISTS weekday_discount;
ALTER TABLE site_config DROP COLUMN IF EXISTS weekend_surcharge;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS day_pricing JSONB DEFAULT '{
  "lunes": {"descuento": 0, "recargo": 0, "comision_reseller": 10},
  "martes": {"descuento": 0, "recargo": 0, "comision_reseller": 10},
  "miercoles": {"descuento": 0, "recargo": 0, "comision_reseller": 10},
  "jueves": {"descuento": 0, "recargo": 0, "comision_reseller": 10},
  "viernes": {"descuento": 0, "recargo": 0, "comision_reseller": 10},
  "sabado": {"descuento": 0, "recargo": 0, "comision_reseller": 10},
  "domingo": {"descuento": 0, "recargo": 0, "comision_reseller": 10}
}';

-- Dynamic pricing (demand-based)
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS dynamic_pricing_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS dynamic_pricing_tiers JSONB DEFAULT '[
  {"threshold": 25, "recargo_percent": 5},
  {"threshold": 50, "recargo_percent": 10},
  {"threshold": 75, "recargo_percent": 20},
  {"threshold": 100, "recargo_percent": 30}
]';

-- Base package includes (editable by admin)
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS glow_includes JSONB DEFAULT '[
  "7 horas de estadía con uso libre de instalaciones (10:00 a 17:00)",
  "Estacionamiento gratuito",
  "Desayuno y almuerzo",
  "Masaje descontracturante",
  "Bebida (jugo, agua saborizada, gaseosa)"
]';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS black_includes JSONB DEFAULT '[
  "7 horas de estadía con uso libre de instalaciones (16:00 a 23:00)",
  "Estacionamiento gratuito",
  "Merienda y cena show",
  "Masaje descontracturante",
  "Bebida (jugo, agua saborizada, gaseosa)"
]';

-- Coupon types update - add 2x1
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS coupon_type TEXT DEFAULT 'discount' CHECK (coupon_type IN ('discount', '2x1', 'free_extra'));
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_people INT DEFAULT 0;

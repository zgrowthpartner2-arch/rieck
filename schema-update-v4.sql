-- V4: Horarios, dias habilitados, reseller custom prices
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS glow_open_time TEXT DEFAULT '10:00';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS glow_close_time TEXT DEFAULT '17:00';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS black_open_time TEXT DEFAULT '16:00';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS black_close_time TEXT DEFAULT '23:00';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS disabled_dates JSONB DEFAULT '[]';
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS enabled_extra_dates JSONB DEFAULT '[]';

-- Reseller custom prices
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS custom_glow_price NUMERIC(10,2);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS custom_black_price NUMERIC(10,2);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS storefront_enabled BOOLEAN DEFAULT FALSE;

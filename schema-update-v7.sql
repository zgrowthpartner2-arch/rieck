-- ============================================
-- SCHEMA UPDATE V7 - Custom commission per affiliate
-- ============================================

-- Custom commission override per affiliate (null = use default levels)
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS custom_commission_percent NUMERIC(5,2);
-- If set, this affiliate gets this % instead of the default level-based commission

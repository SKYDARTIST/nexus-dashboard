-- Nexus Dashboard Schema Enhancements
-- Run this in your Supabase SQL Editor to add payment analytics tracking

-- Add missing columns to purchase_transactions table
ALTER TABLE purchase_transactions 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add indexes for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_transactions_status_date 
  ON purchase_transactions(status, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_product 
  ON purchase_transactions(product_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_created 
  ON sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_created 
  ON user_accounts(created_at DESC);

-- Add session activity tracking for real engagement metrics
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP WITH TIME ZONE;

-- Index for activity-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity 
  ON sessions(last_activity DESC) WHERE is_active = true;

-- Function to auto-expire inactive sessions (optional - can be called by n8n or pg_cron)
CREATE OR REPLACE FUNCTION expire_inactive_sessions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE sessions
  SET 
    is_active = false,
    expired_at = NOW()
  WHERE 
    last_activity < NOW() - INTERVAL '5 minutes'
    AND is_active = true;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a view for daily metrics aggregation
CREATE OR REPLACE VIEW daily_metrics AS
SELECT 
  DATE(verified_at) as metric_date,
  COUNT(*) FILTER (WHERE status = 'success') as successful_payments,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
  SUM(amount) FILTER (WHERE status = 'success') as total_revenue,
  COUNT(DISTINCT google_uid) as unique_users
FROM purchase_transactions
WHERE verified_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(verified_at)
ORDER BY metric_date DESC;

-- Grant permissions if needed
-- GRANT SELECT ON daily_metrics TO anon, authenticated;

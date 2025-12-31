-- Add scheduled_at to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_at ON messages(scheduled_at);

-- Add scheduled fields to users table for status
ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduled_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduled_status_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduled_status_expiration TIMESTAMPTZ;

-- Index for status scheduling
CREATE INDEX IF NOT EXISTS idx_users_scheduled_status_at ON users(scheduled_status_at);

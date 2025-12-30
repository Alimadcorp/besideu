-- Add expo_push_token column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_expo_push_token ON users(expo_push_token);

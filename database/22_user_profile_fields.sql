-- Add profile fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS public_phone TEXT,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS status_expiration TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_business BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_online TIMESTAMPTZ;

-- Add index for is_business to help with discovery
CREATE INDEX IF NOT EXISTS idx_users_is_business ON users(is_business) WHERE is_business = true;

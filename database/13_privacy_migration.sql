-- 13_privacy_migration.sql

-- Migration to support privacy features: custom location hash and phone hash.

-- 1. Alter users table to add phone_hash
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_hash TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);

-- Data migration for users: (Optional/Tricky)
-- Ideally, we would retroactively hash all phones, but we can't do that easily in SQL without the salt.
-- Since this is development, we might assume new users or client-side fixes.
-- However, for correctness, we might need a script. For now, we only change schemas.

-- 2. Alter user_locations to use location_hash instead of geohash
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS location_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_user_locations_location_hash ON user_locations(location_hash);

-- Drop the old geohash column constraint or column itself
ALTER TABLE user_locations ALTER COLUMN geohash DROP NOT NULL;
-- ALTER TABLE user_locations DROP COLUMN IF EXISTS geohash;

-- 3. Modify contacts table structure if needed (JSONB structure)
-- The contacts table stores JSONB, so no schema change is strictly required, 
-- but the application logic now expects an array of strings (hashes) ["hash1", "hash2", ...] for maximum privacy.
-- No schema change needed as JSONB supports arrays.

-- 4. Clean up old data (Optional)
-- UPDATE user_locations SET location_hash = NULL WHERE location_hash IS NULL;

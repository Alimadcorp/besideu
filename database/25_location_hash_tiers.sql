-- 25_location_hash_tiers.sql
-- Add 100m and 500m location hash columns for finer-grained location tracking

ALTER TABLE user_locations 
ADD COLUMN IF NOT EXISTS location_hash_100m TEXT,
ADD COLUMN IF NOT EXISTS location_hash_500m TEXT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_locations_hash_100m ON user_locations(location_hash_100m);
CREATE INDEX IF NOT EXISTS idx_user_locations_hash_500m ON user_locations(location_hash_500m);


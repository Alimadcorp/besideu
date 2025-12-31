-- 24_multi_location_hashes.sql
-- Migration to support multiple location hashes (1km, 3km, 5km grids)

-- Add three location hash columns for different grid sizes
ALTER TABLE user_locations 
ADD COLUMN IF NOT EXISTS location_hash_1km TEXT,
ADD COLUMN IF NOT EXISTS location_hash_3km TEXT,
ADD COLUMN IF NOT EXISTS location_hash_5km TEXT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_locations_hash_1km ON user_locations(location_hash_1km);
CREATE INDEX IF NOT EXISTS idx_user_locations_hash_3km ON user_locations(location_hash_3km);
CREATE INDEX IF NOT EXISTS idx_user_locations_hash_5km ON user_locations(location_hash_5km);

-- Note: The old location_hash column from migration 13 can remain for backward compatibility
-- but the new columns are the primary ones used now


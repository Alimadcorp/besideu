-- 31_deprecate_location_tiers.sql
-- Deprecate location hash tiers: Only use 3km tier going forward
-- This migration documents the deprecation and ensures 3km is the only tier used

-- Note: We keep the columns for backward compatibility but they are no longer used
-- The application now only uses location_hash_3km for all location-based features

-- Add comment to document the change
COMMENT ON COLUMN user_locations.location_hash_100m IS 'DEPRECATED: No longer used. Use location_hash_3km instead.';
COMMENT ON COLUMN user_locations.location_hash_500m IS 'DEPRECATED: No longer used. Use location_hash_3km instead.';
COMMENT ON COLUMN user_locations.location_hash_1km IS 'DEPRECATED: No longer used. Use location_hash_3km instead.';
COMMENT ON COLUMN user_locations.location_hash_5km IS 'DEPRECATED: No longer used. Use location_hash_3km instead.';
COMMENT ON COLUMN user_locations.location_hash_3km IS 'ACTIVE: The only location tier used. Represents 3km grid for privacy-preserving location sharing.';

-- Update users table preferences default to remove range (now fixed at 3km)
-- Note: This doesn't change existing preferences, just documents the new default
-- The application will ignore the range preference going forward


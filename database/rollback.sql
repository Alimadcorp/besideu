-- Rollback Script
-- ⚠️ WARNING: This will delete all tables and data!
-- Run in reverse order of creation

-- Drop tables (in reverse order)
DROP TABLE IF EXISTS meetups CASCADE;
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS friend_requests CASCADE;
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS user_locations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS meetup_status CASCADE;
DROP TYPE IF EXISTS friend_request_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Note: RLS policies are automatically dropped when tables are dropped


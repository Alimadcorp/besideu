-- Test Data (Development Only)
-- ⚠️ WARNING: Only run this in development environment!

-- Insert test users
INSERT INTO users (id, phone, username, real_name, firebase_uid, preferences)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '+1234567890', 'testuser1', 'Test User 1', 'firebase_uid_1', '{"range": 5}'),
    ('00000000-0000-0000-0000-000000000002', '+1234567891', 'testuser2', 'Test User 2', 'firebase_uid_2', '{"range": 10}'),
    ('00000000-0000-0000-0000-000000000003', '+1234567892', 'testuser3', 'Test User 3', 'firebase_uid_3', '{"range": 3}')
ON CONFLICT (id) DO NOTHING;

-- Insert test locations (using example geohashes)
INSERT INTO user_locations (user_id, geohash, updated_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '9q5h', NOW()),
    ('00000000-0000-0000-0000-000000000002', '9q5j', NOW()),
    ('00000000-0000-0000-0000-000000000003', '9q5m', NOW())
ON CONFLICT (user_id) DO UPDATE SET geohash = EXCLUDED.geohash, updated_at = NOW();

-- Insert test friendship
INSERT INTO friends (user_id_1, user_id_2)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (user_id_1, user_id_2) DO NOTHING;

-- Insert test friend request
INSERT INTO friend_requests (from_user_id, to_user_id, status)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'pending')
ON CONFLICT DO NOTHING;


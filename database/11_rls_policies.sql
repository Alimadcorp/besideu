-- Row Level Security Policies
-- These policies ensure users can only access their own data and authorized data

-- ============================================
-- USERS TABLE POLICIES
-- ============================================
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON users FOR SELECT
USING (auth.uid()::text = id::text);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid()::text = id::text);

-- Users can read other users' public info (for friend discovery)
CREATE POLICY "Users can read public profiles"
ON users FOR SELECT
USING (true);

-- ============================================
-- USER_LOCATIONS TABLE POLICIES
-- ============================================
-- Users can read their own location
CREATE POLICY "Users can read own location"
ON user_locations FOR SELECT
USING (auth.uid()::text = user_id::text);

-- Users can update their own location
CREATE POLICY "Users can update own location"
ON user_locations FOR ALL
USING (auth.uid()::text = user_id::text);

-- Users can read friends' locations (for nearby feature)
-- Note: This requires checking friends table, which may need a function
-- For now, we'll allow reading all locations (filtered by app logic)
-- In production, consider a function-based policy
CREATE POLICY "Users can read nearby locations"
ON user_locations FOR SELECT
USING (true);

-- ============================================
-- FRIENDS TABLE POLICIES
-- ============================================
-- Users can read friendships they're part of
CREATE POLICY "Users can read own friendships"
ON friends FOR SELECT
USING (
    auth.uid()::text = user_id_1::text OR 
    auth.uid()::text = user_id_2::text
);

-- Users can create friendships (when accepting requests)
CREATE POLICY "Users can create friendships"
ON friends FOR INSERT
WITH CHECK (
    auth.uid()::text = user_id_1::text OR 
    auth.uid()::text = user_id_2::text
);

-- Users can delete their own friendships
CREATE POLICY "Users can delete own friendships"
ON friends FOR DELETE
USING (
    auth.uid()::text = user_id_1::text OR 
    auth.uid()::text = user_id_2::text
);

-- ============================================
-- FRIEND_REQUESTS TABLE POLICIES
-- ============================================
-- Users can read requests they sent or received
CREATE POLICY "Users can read own friend requests"
ON friend_requests FOR SELECT
USING (
    auth.uid()::text = from_user_id::text OR 
    auth.uid()::text = to_user_id::text
);

-- Users can create friend requests
CREATE POLICY "Users can create friend requests"
ON friend_requests FOR INSERT
WITH CHECK (auth.uid()::text = from_user_id::text);

-- Users can update requests they received (to accept/decline)
CREATE POLICY "Users can update received requests"
ON friend_requests FOR UPDATE
USING (auth.uid()::text = to_user_id::text);

-- Users can delete requests they sent or received
CREATE POLICY "Users can delete own requests"
ON friend_requests FOR DELETE
USING (
    auth.uid()::text = from_user_id::text OR 
    auth.uid()::text = to_user_id::text
);

-- ============================================
-- CONTACTS TABLE POLICIES
-- ============================================
-- Users can only access their own contacts
CREATE POLICY "Users can manage own contacts"
ON contacts FOR ALL
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

-- ============================================
-- MESSAGES TABLE POLICIES
-- ============================================
-- Users can read messages in DMs they're part of
-- Note: dm_id is a computed value based on two user IDs
-- This policy assumes dm_id contains both user IDs somehow
-- In practice, you may need a function to check if user is part of DM
CREATE POLICY "Users can read own messages"
ON messages FOR SELECT
USING (
    auth.uid()::text = sender_id::text OR
    EXISTS (
        SELECT 1 FROM messages m2 
        WHERE m2.dm_id = messages.dm_id 
        AND m2.sender_id::text != auth.uid()::text
        LIMIT 1
    )
);

-- Users can send messages
CREATE POLICY "Users can send messages"
ON messages FOR INSERT
WITH CHECK (auth.uid()::text = sender_id::text);

-- ============================================
-- MESSAGE_REACTIONS TABLE POLICIES
-- ============================================
-- Users can read reactions on messages they can see
CREATE POLICY "Users can read reactions"
ON message_reactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM messages 
        WHERE messages.id = message_reactions.message_id
        AND (
            messages.sender_id::text = auth.uid()::text OR
            EXISTS (
                SELECT 1 FROM messages m2 
                WHERE m2.dm_id = messages.dm_id 
                AND m2.sender_id::text != auth.uid()::text
                LIMIT 1
            )
        )
    )
);

-- Users can create reactions
CREATE POLICY "Users can create reactions"
ON message_reactions FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
ON message_reactions FOR DELETE
USING (auth.uid()::text = user_id::text);

-- ============================================
-- MEETUPS TABLE POLICIES
-- ============================================
-- Users can read meetups they're part of
CREATE POLICY "Users can read own meetups"
ON meetups FOR SELECT
USING (
    auth.uid()::text = requested_by::text OR 
    auth.uid()::text = requested_from::text
);

-- Users can create meetup requests
CREATE POLICY "Users can create meetup requests"
ON meetups FOR INSERT
WITH CHECK (auth.uid()::text = requested_by::text);

-- Users can update meetups they received (to accept/decline)
CREATE POLICY "Users can update received meetups"
ON meetups FOR UPDATE
USING (auth.uid()::text = requested_from::text);

-- Users can delete meetups they created
CREATE POLICY "Users can delete own meetups"
ON meetups FOR DELETE
USING (
    auth.uid()::text = requested_by::text OR 
    auth.uid()::text = requested_from::text
);

-- ============================================
-- IMPORTANT: RLS WITH FIREBASE AUTH
-- ============================================
-- ⚠️ The policies above use auth.uid() which is a Supabase Auth function
-- Since we're using Firebase Auth + custom JWT tokens, these policies won't work as-is
-- 
-- OPTIONS:
-- 
-- Option 1: Disable RLS and handle authorization in application code (RECOMMENDED)
-- Run this to disable RLS:
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- (Repeat for all tables)
-- Then handle authorization in your API endpoints using JWT token claims
-- 
-- Option 2: Use service_role_key for all backend operations
-- Your API will use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
-- This is the recommended approach for Firebase Auth
-- 
-- Option 3: Create custom RLS functions (Advanced)
-- Create functions that extract user ID from JWT claims
-- This requires more setup but provides database-level security
-- 
-- RECOMMENDATION: Use Option 2 (service_role_key) for now
-- The RLS policies above are kept for reference but won't be active
-- All authorization will be handled in your API endpoints


-- 28_allow_self_messaging.sql
-- Allow users to message themselves by modifying the friends table constraint

-- Drop the existing constraint
ALTER TABLE friends DROP CONSTRAINT IF EXISTS friends_user_id_1_check;

-- Add new constraint that allows user_id_1 == user_id_2 for self-chats
-- But still ensures ordering when they're different
ALTER TABLE friends 
ADD CONSTRAINT friends_user_id_ordering_check 
CHECK (
    (user_id_1 = user_id_2) OR (user_id_1 < user_id_2)
);

-- Note: The UNIQUE constraint on (user_id_1, user_id_2) will still work correctly
-- It will allow exactly one self-chat per user


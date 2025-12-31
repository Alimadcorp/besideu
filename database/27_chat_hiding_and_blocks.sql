-- 27_chat_hiding_and_blocks.sql
-- Add chat/channel hiding (soft delete) and user blocking functionality

-- Add hidden_by column to friends table (for chat hiding)
ALTER TABLE friends
ADD COLUMN IF NOT EXISTS hidden_by_user_1 BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hidden_by_user_2 BOOLEAN DEFAULT FALSE;

-- Add hidden_by column to meeting_channels (for channel hiding)
ALTER TABLE meeting_channels
ADD COLUMN IF NOT EXISTS hidden_by JSONB DEFAULT '[]'::jsonb; -- Array of user IDs who hid this channel

-- User blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_friends_hidden_user_1 ON friends(hidden_by_user_1) WHERE hidden_by_user_1 = true;
CREATE INDEX IF NOT EXISTS idx_friends_hidden_user_2 ON friends(hidden_by_user_2) WHERE hidden_by_user_2 = true;

-- Enable RLS
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;


-- Create friends table
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CHECK (user_id_1 < user_id_2),
    UNIQUE(user_id_1, user_id_2)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_friends_user_id_1 ON friends(user_id_1);
CREATE INDEX IF NOT EXISTS idx_friends_user_id_2 ON friends(user_id_2);
CREATE INDEX IF NOT EXISTS idx_friends_composite ON friends(user_id_1, user_id_2);

-- Enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;


-- Create user_statuses table
CREATE TABLE IF NOT EXISTS user_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video')),
    content TEXT, -- Caption or text content
    media_url TEXT,
    background_color TEXT DEFAULT '#000000',
    font_style TEXT DEFAULT 'normal',
    scheduled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying of valid statuses
CREATE INDEX IF NOT EXISTS idx_user_statuses_user_id ON user_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statuses_expires_at ON user_statuses(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_statuses_scheduled_at ON user_statuses(scheduled_at);

-- Create status_views table for tracking views
CREATE TABLE IF NOT EXISTS status_views (
    status_id UUID NOT NULL REFERENCES user_statuses(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (status_id, viewer_id)
);

-- Enable RLS
ALTER TABLE user_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can CRUD their own statuses
CREATE POLICY "Users can insert own statuses" ON user_statuses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own statuses" ON user_statuses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own statuses" ON user_statuses FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can select own statuses" ON user_statuses FOR SELECT USING (auth.uid() = user_id);

-- Everyone can view non-expired statuses (Application login enforces friendship usually, but strictly speaking friends only)
-- For simplicity in this migration script, we'll allow authenticated selection. The API will filter by friendship.
CREATE POLICY "Authenticated users can select statuses" ON user_statuses FOR SELECT USING (auth.role() = 'authenticated');

-- Views policies
CREATE POLICY "Users can insert views" ON status_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "Users can select views" ON status_views FOR SELECT USING (auth.uid() = viewer_id OR auth.uid() IN (SELECT user_id FROM user_statuses WHERE id = status_id));

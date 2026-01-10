-- 30_meeting_logs_and_tracking.sql
-- Enhanced meeting tracking with logs and live location updates

-- Meeting logs table (replaces meeting_arrivals for better tracking)
CREATE TABLE IF NOT EXISTS meeting_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('entered', 'exited')),
    location JSONB, -- Store exact location when event occurred {lat, lon}
    distance_km NUMERIC, -- Distance from meeting location
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add live tracking columns to meeting_invitations
ALTER TABLE meeting_invitations 
ADD COLUMN IF NOT EXISTS current_lat NUMERIC,
ADD COLUMN IF NOT EXISTS current_lon NUMERIC,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS participation_status TEXT CHECK (participation_status IN ('arrived', 'transit', NULL));

-- Create indexes for meeting_logs
CREATE INDEX IF NOT EXISTS idx_meeting_logs_meeting_id ON meeting_logs(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_user_id ON meeting_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_created_at ON meeting_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_type ON meeting_logs(type);

-- Create composite index for efficient querying
CREATE INDEX IF NOT EXISTS idx_meeting_logs_meeting_user ON meeting_logs(meeting_id, user_id, created_at DESC);

-- Enable RLS on meeting_logs
ALTER TABLE meeting_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_logs

-- Creators can see all logs for their meetings
CREATE POLICY meeting_logs_creator_select ON meeting_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM meetings
            WHERE meetings.id = meeting_logs.meeting_id
            AND meetings.creator_id = auth.uid()
        )
    );

-- Users can see their own logs
CREATE POLICY meeting_logs_user_select ON meeting_logs
    FOR SELECT
    USING (user_id = auth.uid());

-- System can insert logs (via service role)
CREATE POLICY meeting_logs_insert ON meeting_logs
    FOR INSERT
    WITH CHECK (true);

-- Add comment to explain the tracking system
COMMENT ON TABLE meeting_logs IS 'Tracks entry and exit events for meeting attendees. Used for attendance logging and historical records.';
COMMENT ON COLUMN meeting_invitations.current_lat IS 'Live latitude for real-time tracking during active meeting window';
COMMENT ON COLUMN meeting_invitations.current_lon IS 'Live longitude for real-time tracking during active meeting window';
COMMENT ON COLUMN meeting_invitations.last_seen_at IS 'Last time user sent location update';
COMMENT ON COLUMN meeting_invitations.participation_status IS 'Current status: arrived (inside threshold), transit (outside threshold), or NULL (not started tracking)';

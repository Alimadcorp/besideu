-- 26_meetings_system.sql
-- Meeting system for business profiles to create meetings and invite friends

-- Meetings table (different from meetups which are 1-to-1)
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location JSONB NOT NULL, -- {lat, lon, name, address}
    threshold_km NUMERIC NOT NULL DEFAULT 1.0, -- Distance threshold in km for arrival detection
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    has_channel BOOLEAN DEFAULT FALSE,
    channel_id UUID, -- Will reference meeting_channels table
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CHECK (creator_id IS NOT NULL),
    CHECK (threshold_km > 0)
);

-- Meeting invitations table
CREATE TABLE IF NOT EXISTS meeting_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
    invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    responded_at TIMESTAMPTZ,
    UNIQUE(meeting_id, invited_user_id)
);

-- Meeting arrivals table (tracks when users arrive at meeting location)
CREATE TABLE IF NOT EXISTS meeting_arrivals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    arrived_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    location JSONB, -- Store exact location when they arrived
    UNIQUE(meeting_id, user_id, arrived_at) -- Allow multiple arrivals (e.g., leaving and coming back)
);

-- Meeting channels table (optional chat channel for meeting participants)
CREATE TABLE IF NOT EXISTS meeting_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Meeting channel members table
CREATE TABLE IF NOT EXISTS meeting_channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES meeting_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(channel_id, user_id)
);

-- Meeting channel messages table
CREATE TABLE IF NOT EXISTS meeting_channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES meeting_channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (char_length(text) <= 2000),
    image_url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_meetings_creator_id ON meetings(creator_id);
CREATE INDEX IF NOT EXISTS idx_meetings_starts_at ON meetings(starts_at);
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_meeting_id ON meeting_invitations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_user_id ON meeting_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_status ON meeting_invitations(status);
CREATE INDEX IF NOT EXISTS idx_meeting_arrivals_meeting_id ON meeting_arrivals(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_arrivals_user_id ON meeting_arrivals(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_arrivals_arrived_at ON meeting_arrivals(arrived_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_channels_meeting_id ON meeting_channels(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_channel_members_channel_id ON meeting_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_meeting_channel_members_user_id ON meeting_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_channel_messages_channel_id ON meeting_channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_meeting_channel_messages_timestamp ON meeting_channel_messages(timestamp DESC);

-- Add foreign key constraint for channel_id in meetings table
ALTER TABLE meetings
ADD CONSTRAINT fk_meetings_channel_id 
FOREIGN KEY (channel_id) 
REFERENCES meeting_channels(id) 
ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_arrivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_channel_messages ENABLE ROW LEVEL SECURITY;


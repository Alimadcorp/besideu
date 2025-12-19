-- Create meetups table
CREATE TABLE IF NOT EXISTS meetups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dm_id UUID NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_from UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status meetup_status DEFAULT 'pending' NOT NULL,
    location JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CHECK (requested_by != requested_from)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_meetups_dm_id ON meetups(dm_id);
CREATE INDEX IF NOT EXISTS idx_meetups_requested_by ON meetups(requested_by);
CREATE INDEX IF NOT EXISTS idx_meetups_requested_from ON meetups(requested_from);
CREATE INDEX IF NOT EXISTS idx_meetups_status ON meetups(status);
CREATE INDEX IF NOT EXISTS idx_meetups_expires_at ON meetups(expires_at) WHERE expires_at IS NOT NULL;

-- Add foreign key constraint for meetup_request_id in messages table
ALTER TABLE messages 
ADD CONSTRAINT fk_messages_meetup_request_id 
FOREIGN KEY (meetup_request_id) 
REFERENCES meetups(id) 
ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE meetups ENABLE ROW LEVEL SECURITY;


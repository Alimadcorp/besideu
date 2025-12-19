-- Create custom enum types for status fields

-- Friend request status enum
CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

-- Meetup status enum
CREATE TYPE meetup_status AS ENUM ('pending', 'accepted', 'declined', 'expired');


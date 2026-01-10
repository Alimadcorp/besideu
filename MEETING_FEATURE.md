# Meeting Feature Implementation Summary

## Overview
The meeting feature allows business users to create meetings, invite friends/contacts, and track attendance in real-time with comprehensive logging.

## Database Changes (30_meeting_logs_and_tracking.sql)

### New Table: `meeting_logs`
- Tracks entry/exit events for meeting attendees
- Columns:
  - `id`: UUID primary key
  - `meeting_id`: Reference to meetings table
  - `user_id`: Reference to users table
  - `type`: 'entered' or 'exited'
  - `location`: JSONB {lat, lon}
  - `distance_km`: Distance from meeting location
  - `created_at`: Timestamp

### Enhanced Table: `meeting_invitations`
New columns added:
- `current_lat`: Live latitude for real-time tracking
- `current_lon`: Live longitude for real-time tracking
- `last_seen_at`: Last time user sent location update
- `participation_status`: 'arrived', 'transit', or NULL

## Key Features Implemented

### 1. Meeting Creation (create.tsx)
- Business users can create meetings with:
  - Title, description, location
  - Start/end times
  - Distance threshold (for arrival detection)
  - Optional group chat channel
- **Friend/Contact Selection**: Modal to select invitees from friends and contacts
- Sends invitations to selected users

### 2. Meeting Details ([id].tsx)

#### For Creators:
- **3 Tabs**: Overview, Live Map, Logs
- **Overview Tab**: Meeting details, location, chat access
- **Live Map Tab**: 
  - Real-time map showing meeting location with radius circle
  - Live pins for all attendees with current locations
  - Participant status list overlay
  - Updates every 10 seconds via polling
- **Logs Tab**: 
  - Historical log of all entry/exit events
  - Shows who arrived when, who left when
  - Distance information for each event
  - Persists forever for future review

#### For Attendees:
- **Overview Tab Only**: Can see meeting details and accept/decline
- **Auto-Tracking**: 
  - Starts 3 hours before meeting start
  - Ends 3 hours after meeting end
  - Sends location every 30 seconds
  - Automatically logs entry/exit events

### 3. Tracking Logic (check-arrival API)

#### Entry/Exit Detection:
1. Compares user's current location to meeting location
2. Checks if within threshold distance
3. Looks at last log entry to determine state
4. If crossing threshold:
   - Logs 'entered' or 'exited' event
   - Posts system message to chat channel (if exists)
   - Updates live location in `meeting_invitations`

#### Location Sharing Rules:
- Shares location while tracking is active
- Tracks both entry AND exit (as requested)
- Updates `participation_status`:
  - 'arrived': Inside threshold
  - 'transit': Outside threshold
  - NULL: Not started tracking

### 4. Chat Integration
- System messages posted to meeting channel on entry/exit
- Format: "{username} has reached the meeting location." or "has left the meeting location."
- Messages attributed to the user (sender_id = user.id)

### 5. Time Windows
- **Creator View**: Available 3 hours before start to 3 hours after end
- **Attendee Access**: Can view details during same window
- **After Meeting**: Logs persist for creator to review anytime
- **Tracking**: Auto-starts/stops based on time window

## API Endpoints Enhanced

### `/v1/meetings/create` (POST)
- Added `invite_user_ids` array to body
- Creates meeting and sends invitations

### `/v1/meetings/[id]` (GET)
- Returns enhanced attendee data with live locations
- Returns `logs` array for creators (instead of `arrivals`)
- Includes `participation_status`, `current_lat`, `current_lon`, `last_seen_at`

### `/v1/meetings/[id]/check-arrival` (POST)
- Enhanced to track entry/exit events
- Posts to chat channel
- Updates live location
- Returns `status`: 'arrived' or 'transit'

## Frontend Implementation Details

### Auto-Polling (Creator)
```typescript
pollRef.current = setInterval(fetchMeeting, 10000); // Every 10s
```

### Auto-Tracking (Attendee)
```typescript
trackRef.current = setInterval(checkArrival, 30000); // Every 30s
```

### Cleanup
- Both intervals cleared on component unmount
- Proper cleanup in useEffect return functions

## Security & Privacy

### RLS Policies (in SQL file):
- Creators can see all logs for their meetings
- Users can see their own logs
- System (service role) can insert logs

### Access Control:
- Only creators see Live Map tab
- Only creators see detailed logs with distances
- Attendees only see overview during active window

## Usage Flow

1. **Business user creates meeting** → Selects friends/contacts to invite
2. **Invitees receive invitation** → Accept or decline
3. **3 hours before start** → Tracking begins for accepted attendees
4. **During meeting** → Creator sees live map, attendees auto-tracked
5. **Entry/Exit** → Logged automatically, posted to chat
6. **3 hours after end** → Tracking stops, attendees lose access
7. **Anytime later** → Creator can review logs

## Notes

- Location tracking requires foreground permissions
- Map uses `react-native-maps` library
- All timestamps in ISO8601 format
- Distance calculations use Haversine formula
- Logs are immutable (no deletion/editing)

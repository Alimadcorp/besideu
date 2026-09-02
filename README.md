# BesideU

## An app by Muhammad Ali and Habeebullah Arif Wattoo

This is a location aware social app. An app that tells you when a friend is nearby, and with end-to-end-encrytion, the locations of users are safe, and calculations are performed on regional hashes instead of exact cooridinates.

---

## Table of Contents

- [Structure](#structure)
- [Frontend](#frontend)
- [Backend](#backend)

---

## Structure

`.`: Contains the main Flutter app (co.alimad.besideu)

`server`: Contains the server code

---

The rest of this readme is written by AI, it will be replaced soon...

---

## Frontend

### Technology:
  - Flutter

#### Main Tabs:
1. **Chats** (`(tabs)/index`) - List of all DM conversations
2. **Map** (`(tabs)/maps`) - Shows nearby friends based on location
3. **Status** (`(tabs)/status`) - View and post Instagram-style stories
4. **Profile** (`(tabs)/profile`) - User profile and settings

#### Additional Screens:
- **Intro** (`intro`) - First-time user onboarding (shown once)
- **Auth** (`auth/`) - Login and signup flows
- **Chats** (`chats/[id]`) - Individual chat conversation
- **Meetings** (`meetings/`) - Create and view meetings (business accounts)
- **Friends** (`friends/`) - Manage friends and friend requests
- **Contacts** (`contacts/`) - Sync and invite from phone contacts
- **User Profile** (`user/[id]`) - View other users' profiles
- **Status** (`status/`) - Create and view user statuses

### Features:

#### 1. **Location-Based Friend Discovery**
- Privacy-preserving location hashing (Geohash)
- See friends within customizable radius (1-50km)
- Real-time location updates via WebSocket
- Distance shown as "near" or "far" for privacy

#### 2. **Chat System**
- Direct messaging with friends
- Message reactions
- Image sharing
- Meetup requests (1-to-1 location sharing)
- Read receipts and unread counts
- Chat hiding and blocking
- Self-messaging (notes to self)

#### 3. **User Statuses**
- Instagram-style stories
- Text, image, and video statuses
- 24-hour expiration
- Scheduled status posting
- View tracking
- Custom backgrounds and fonts

#### 4. **Meeting System** (Business Accounts Only)
- Create meetings with location and time
- Invite multiple friends/contacts
- Real-time attendance tracking
- Live map view showing all attendees
- Automatic entry/exit logging
- Historical attendance logs
- Group chat for meeting participants
- Active window: 3 hours before to 3 hours after meeting

#### 5. **Friend Management**
- Add friends from contacts
- Send/accept/decline friend requests
- Remove friends
- Privacy-preserving contact matching (hashed phone numbers)

#### 6. **User Profiles**
- Personal and business profiles
- Custom bio, website, status
- Scheduled status updates
- Avatar upload
- Email verification
- Customizable discovery radius

#### 7. **Intro Screen**
- First-time user onboarding
- Explains key features: nearby, chats, meetups
- Only shown once per device

---

## Backend

### Technologies:
  - Idk maybe SpacetimeDB using Rust

#### Authentication Endpoints (`/auth`)

The app authenticates users based on phone number only. Later on you can link your Email to your account (by email verification).

- **POST** `/auth/signup`
  
  Register a new user account. Client authenticates with Firebase phone auth first, then sends Firebase ID token to this endpoint.
  
  **Body**: 
  ```json
  {
    "firebase_token": "string",
    "username": "string",
    "real_name": "string",
    "email": "string (optional)"
  }
  ```
  
  **Response**: 
  ```json
  {
    "success": true,
    "token": "jwt_token_string",
    "user": {
      "id": "string",
      "phone": "string",
      "username": "string"
    }
  }
  ```

- **POST** `/auth/login`
  
  Login with Firebase phone authentication.
  
  **Body**: 
  ```json
  {
    "firebase_token": "string"
  }
  ```
  
  **Response**: 
  ```json
  {
    "token": "jwt_token_string",
    "expires_in": 86400,
    "user": {
      "id": "string",
      "phone": "string",
      "username": "string"
    }
  }
  ```

#### Protected Endpoints (`/v1`)

The entire `/v1` route is secured by JWT Bearer Authentication. Each request must have `Authorization: Bearer <token>` in headers.

##### Location Endpoints

- **PUT** `/v1/location/set`
  
  Set your location (stores location hash only).
  
  **Body**: 
  ```json
  {
    "location_hash": "string",
    "timestamp": "ISO8601_string",
    "meta": {
      "upload_reason": "string (optional)",
      "attempt_no": "number (optional)"
    }
  }
  ```

- **GET** `/v1/location/find`
  
  Get other users in your range based on location hash proximity.
  
  **Query Parameters**: 
  - `range?` (number, in kilometers)
  - `filter?` (string, optional)

##### Friends Endpoints

- **POST** `/v1/friends/add` - Send friend request
- **GET** `/v1/friends/requests` - List pending requests
- **GET** `/v1/friends/list` - List all friends
- **POST** `/v1/friends/accept` - Accept friend request
- **DELETE** `/v1/friends/remove` - Remove friend

##### Contacts Endpoints

- **PUT** `/v1/contacts/set` - Upload contacts (hashed phone numbers)
- **GET** `/v1/contacts/list` - Check which contacts use the app

##### Messages Endpoints

- **GET** `/v1/messages/list` - Get DM list with unread counts
- **GET** `/v1/messages/:id/get` - Get messages in a DM
- **POST** `/v1/messages/:id/send` - Send a message
- **POST** `/v1/messages/:id/meetup` - Send meetup location
- **POST** `/v1/messages/:id/react` - React to a message
- **POST** `/v1/messages/:id/read` - Mark messages as read
- **POST** `/v1/messages/:id/hide` - Hide a chat

##### Status Endpoints

- **POST** `/v1/status` - Create a new status
- **GET** `/v1/status/me` - Get your statuses
- **GET** `/v1/status/feed` - Get friends' statuses
- **POST** `/v1/status/:id/view` - Mark status as viewed

##### Meeting Endpoints (Business Accounts Only)

- **POST** `/v1/meetings/create` - Create a meeting
  ```json
  {
    "title": "string",
    "description": "string",
    "location": {"lat": number, "lon": number, "name": "string"},
    "threshold_km": number,
    "starts_at": "ISO8601_string",
    "ends_at": "ISO8601_string",
    "has_channel": boolean,
    "invite_user_ids": ["user_id"]
  }
  ```

- **GET** `/v1/meetings/list` - List your meetings
- **GET** `/v1/meetings/:id` - Get meeting details (includes live locations and logs for creator)
- **POST** `/v1/meetings/:id/respond` - Accept/decline invitation
- **POST** `/v1/meetings/:id/check-arrival` - Check in at meeting (auto-called by app)
- **POST** `/v1/meetings/:id/invite` - Invite additional users
- **GET** `/v1/meetings/:id/channel/messages` - Get meeting chat messages

##### User Endpoints

- **GET** `/v1/user/me` - Get current user profile
- **PUT** `/v1/user/settings` - Update user settings
- **GET** `/v1/user/:id/profile` - Get another user's profile
- **POST** `/v1/user/resend-verification` - Resend email verification
- **POST** `/v1/user/block` - Block/unblock a user
- **POST** `/v1/user/create-self-chat` - Create self-messaging chat
- **GET** `/v1/user/lookup` - Look up user by username

##### Media Endpoints

- **POST** `/v1/image/upload` - Upload image to ImgBB

##### Other Endpoints

- **POST** `/v1/logout` - Logout and invalidate session

##### Cron Endpoints (Internal)

- **POST** `/v1/cron/scheduled-status` - Process scheduled statuses
- **POST** `/v1/cron/scheduled-messages` - Process scheduled messages

### Express WebSocket App

**Purpose**: Real-time updates for location, messages, friend requests, and meeting events.

**Deployment**: `wss://ws.besideu.alimad.co`

**Connection**: Authenticate with `Authorization: Bearer <token>` header, then upgrade to WebSocket.

#### WebSocket Message Types:

**Client → Server**:
```json
{
  "type": "location_update",
  "payload": {
    "location_hash": "string",
    "timestamp": "ISO8601_string"
  }
}
```

**Server → Client**:
- `new_message` - New DM received
- `friend_request` - New friend request
- `friend_accepted` - Friend request accepted
- `meetup_request` - Meetup request received
- `meetup_accepted` - Meetup accepted with location
- `meeting_update` - Meeting status changed
- `status_posted` - Friend posted new status
- `ping` / `pong` - Keep-alive

---

## Database Schema

The following tables exist in Supabase:

### Core Tables

#### `users`
- `id` (UUID, primary key)
- `phone` (string, unique, indexed)
- `username` (string, unique)
- `real_name` (string)
- `firebase_uid` (string, unique)
- `email` (string, nullable)
- `email_verified` (boolean)
- `avatar_url` (string)
- `bio` (text)
- `website` (string)
- `status` (string) - Current user status
- `status_expiration` (timestamp)
- `scheduled_status` (string)
- `scheduled_status_at` (timestamp)
- `scheduled_status_expiration` (timestamp)
- `is_business` (boolean)
- `business_type` (string)
- `public_phone` (string)
- `preferences` (JSONB) - Contains `range`, `share_location`, etc.
- `expo_push_token` (string)
- `created_at`, `updated_at` (timestamps)

#### `user_locations`
- `id` (UUID)
- `user_id` (UUID, foreign key)
- `location_hash` (string, indexed) - Privacy-preserving geohash
- `updated_at` (timestamp)

#### `friends`
- `id` (UUID)
- `user_id_1`, `user_id_2` (UUIDs, ordered: user_id_1 < user_id_2)
- `last_message` (string)
- `last_message_at` (timestamp)
- `last_read_at_1`, `last_read_at_2` (timestamps)
- `unread_count_1`, `unread_count_2` (integers)
- `hidden_by_1`, `hidden_by_2` (booleans)
- `created_at` (timestamp)

#### `friend_requests`
- `id` (UUID)
- `from_user_id`, `to_user_id` (UUIDs)
- `status` (enum: pending, accepted, declined, cancelled)
- `created_at` (timestamp)

#### `contacts`
- `id` (UUID)
- `user_id` (UUID)
- `contacts_data` (JSONB) - Array of {name, phone_hashes[]}
- `last_synced_at` (timestamp)

#### `messages`
- `id` (UUID)
- `dm_id` (UUID, indexed)
- `sender_id` (UUID)
- `text` (string, max 2000 chars)
- `image_url` (string)
- `timestamp` (timestamp)
- `meetup_request_id` (UUID, nullable)

#### `message_reactions`
- `id` (UUID)
- `message_id` (UUID)
- `user_id` (UUID)
- `reaction` (string) - emoji
- `timestamp` (timestamp)

#### `meetups`
- `id` (UUID)
- `dm_id` (UUID)
- `requested_by`, `requested_from` (UUIDs)
- `status` (enum: pending, accepted, declined, expired)
- `location` (JSONB) - {long, lat, alt}
- `expires_at` (timestamp)
- `created_at` (timestamp)

#### `user_blocks`
- `blocker_id`, `blocked_id` (UUIDs)
- `created_at` (timestamp)

### Status Tables

#### `user_statuses`
- `id` (UUID)
- `user_id` (UUID)
- `type` (enum: text, image, video)
- `content` (text) - Caption
- `media_url` (string)
- `background_color` (string)
- `font_style` (string)
- `scheduled_at` (timestamp)
- `expires_at` (timestamp)
- `created_at` (timestamp)

#### `status_views`
- `status_id`, `viewer_id` (UUIDs)
- `viewed_at` (timestamp)

### Meeting Tables

#### `meetings`
- `id` (UUID)
- `creator_id` (UUID)
- `title` (string)
- `description` (text)
- `location` (JSONB) - {lat, lon, name, address}
- `threshold_km` (numeric) - Distance threshold for arrival
- `starts_at`, `ends_at` (timestamps)
- `has_channel` (boolean)
- `channel_id` (UUID)
- `created_at`, `updated_at` (timestamps)

#### `meeting_invitations`
- `id` (UUID)
- `meeting_id` (UUID)
- `invited_user_id` (UUID)
- `status` (enum: pending, accepted, declined)
- `current_lat`, `current_lon` (numeric) - Live tracking
- `last_seen_at` (timestamp)
- `participation_status` (enum: arrived, transit, NULL)
- `invited_at`, `responded_at` (timestamps)

#### `meeting_logs`
- `id` (UUID)
- `meeting_id`, `user_id` (UUIDs)
- `type` (enum: entered, exited)
- `location` (JSONB)
- `distance_km` (numeric)
- `created_at` (timestamp)

#### `meeting_channels`
- `id` (UUID)
- `meeting_id` (UUID, unique)
- `created_at`, `updated_at` (timestamps)

#### `meeting_channel_members`
- `id` (UUID)
- `channel_id`, `user_id` (UUIDs)
- `joined_at` (timestamp)

#### `meeting_channel_messages`
- `id` (UUID)
- `channel_id`, `sender_id` (UUIDs)
- `text` (string)
- `image_url` (string)
- `timestamp`, `created_at` (timestamps)

### Row Level Security (RLS)
All tables have RLS policies to ensure users can only access their own data and data they're authorized to see (friends, messages, etc.).

### Indexes
- Location hashes for efficient proximity queries
- Message timestamps for pagination
- User IDs for relationship lookups
- Meeting logs for attendance tracking

---

## Environment Variables

### NextJS API (`api/`)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_EXPIRES_IN` - JWT expiration time (default: 24h)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key
- `IMGBB_API_KEY` - ImgBB API key for image uploads
- `NODE_ENV` - Environment (development/production)

### Express WebSocket (`socket/`)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `JWT_SECRET` - Same JWT secret as NextJS API
- `PORT` - Server port (default: 2999)
- `NODE_ENV` - Environment (development/production)

### Frontend Client (`client/`)
- `EXPO_PUBLIC_API_URL` - API base URL
- `EXPO_PUBLIC_WS_URL` - WebSocket URL
- `EXPO_PUBLIC_FIREBASE_API_KEY` - Firebase web API key
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID

---

## Authentication Flow

1. **Signup**: 
   - Client uses Firebase phone authentication
   - Firebase sends SMS verification code
   - User enters code in Firebase SDK
   - Client receives Firebase ID token
   - Client sends token to `/auth/signup` with username and real_name
   - Backend verifies token using Firebase Admin SDK
   - Backend creates user in Supabase
   - Backend generates and returns JWT token

2. **Login**: 
   - Same Firebase phone auth flow
   - Client sends token to `/auth/login`
   - Backend verifies and returns JWT token (valid 24 hours)

3. **Protected Routes**: 
   - All `/v1/*` endpoints require JWT in `Authorization: Bearer <token>` header
   - Token validated on each request
   - User context extracted from JWT payload

4. **Logout**: 
   - Token invalidated
   - Push token cleared from server

---

## Key Features Summary

✅ **Privacy-Preserving Location Sharing** - Geohash-based proximity detection  
✅ **Real-Time Chat** - DMs with reactions, images, and meetup requests  
✅ **Friend Discovery** - Contact sync with hashed phone numbers  
✅ **User Statuses** - Instagram-style stories with scheduling  
✅ **Meeting System** - Real-time attendance tracking for business accounts  
✅ **Background Updates** - Location and message updates via WebSocket  
✅ **First-Time Intro** - Onboarding screen shown once  
✅ **Profile Customization** - Personal and business profiles  
✅ **Email Verification** - Optional email linking  
✅ **Self-Messaging** - Notes to self feature  
✅ **Chat Management** - Hide chats, block users  

---

**Note**: See `MEETING_FEATURE.md` for detailed meeting system documentation.
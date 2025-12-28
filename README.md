# BesideU

**App name**: BesideU

**Logo**: **BU**

**App tagline**: _Wo line maarne waale uncle zara bahir gaye hain_

**TODO** Make this thing finished, as I don't have enough knowledge yet of all this.

The main purpose of this app is to connect users physically. They must be location aware of each other. App will work similar to Facebook where you can add friends based on contacts. You can see which one of those friends are nearby (in an X kilometer radius, varying on their and other's preferences), you can chat with those friends. You can send meetup requests to those friends to make them send their exact location.

---

## Table of Contents

- [Structure](#structure)
- [Frontend](#frontend)
  - [Technologies](#technologies)
  - [Deployment](#deployment)
  - [Layout](#layout)
- [Backend](#backend)
  - [Technologies](#technologies-1)
  - [Deployment](#deployment-1)
  - [NextJS App API](#nextjs-app-api)
  - [Express WebSocket App](#express-websocket-app)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Authentication Flow](#authentication-flow)

---

## Structure

`client`: Contains the Frontend Expo.dev client code (co.alimad.besideu)

`web`: Do not touch, contains a NextJS app for advertisement (https://besideu.alimad.co)

`api`: Contains NextJS backend (https://api.besideu.alimad.co)

`socket`: Contains Express backend (https://ws.besideu.alimad.co)

---

## Frontend

### Technologies:
  - Expo.dev (React Native)

### Deployment:
  - Will be released as Android-only app on Google Play Store

### Layout:

There will be two main pages: `chats` and `map`

Then there will be the `chat` layout which of course will be a chatting client. You can send and receive messages. The user will poll new messages based on `last_fetched_timestamp`. The user will be updated about new messages through WebSocket. The user will fetch the new messages through the API still.

The app will run a WebSocket connection always in the background, updating the user's current location to the backend, and awaiting any new message notifications.

**Chats**

It will have chats list, user can open any one chat and send or receive messages. User can send a `meetup` request in order to ask the other user for their exact location for a meetup.

**Map**

It will not show a map, it will show a list of the nearby users. User can only see his distance from them, based on Geohash.

---

## Backend

### Technologies:
  - NextJS as backend API
  - Supabase as storage and operations
  - One separate Express app for WebSocket

### Deployment:
  - NextJS app must be deployable on Vercel (Operations must be optimized to run within at most 5 seconds)
  - Express app will temporarily deploy on Railway.app

### NextJS App API

This app will work on the app router, and will expose many API methods to allow users to perform operations. We will store only a custom privacy-preserving hash of the location of all the users in the server, and use that to find neighboring users. We can use the exact location only when a `meetup` is requested.

**Base URL**: `https://api.besideu.alimad.co`

#### Authentication Endpoints (`/auth`)

The app will authenticate users based on phone number only. Later on you can link your Email to your account (by email verification).

- **POST** `/auth/signup`

  Register a new user account. Client authenticates with Firebase phone auth first, then sends Firebase ID token to this endpoint.
  
  **Body**: 
  ```json
  {
    "firebase_token": "string",
    "username": "string",
    "real_name": "string"
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
  
  **Error Response**:
  ```json
  {
    "error": "string",
    "code": "string"
  }
  ```

- **POST** `/auth/login`

  Login with Firebase phone authentication. Client authenticates with Firebase first, then sends Firebase ID token to this endpoint.
  
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
  
  **Error Response**:
  ```json
  {
    "error": "string",
    "code": "string"
  }
  ```

#### Protected Endpoints (`/v1`)

The entire `/v1` route will be secured by JWT Bearer Authentication. The JWT token is issued by the API after verifying the Firebase ID token. The current_user will be resolved by reading their verified token. Each of these requests must have `Authorization: Bearer <token>` in their headers.

**JWT Token Format**: Standard JWT with user ID and phone number in payload. Expires after 24 hours. This token is separate from Firebase tokens and is used for API authentication.

**Error Response Format**:
```json
{
  "error": "string",
  "code": "string",
  "status": 400
}
```

##### Location Endpoints

- **PUT** `/v1/location/set`

  Set your location (store the user's location hash only in the server).
  
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
  
  **Response**: 
  ```json
  {
    "success": true,
    "updated_at": "ISO8601_string"
  }
  ```

- **GET** `/v1/location/find`

  Get other users in your `range` (kilometers) based on location hash proximity.
  
  **Query Parameters**: 
  - `range?` (number, in kilometers) - If none provided, defaults to `current_user.preference.range`
  - `filter?` (string, optional) - Filter by friend status or other criteria
  
  **Response**: 
  ```json
  {
    "users": [
      {
        "id": "string",
        "username": "string",
        "distance": "near|far",
        "location_hash": "string"
      }
    ]
  }
  ```

**Location Hash**: A custom hash generated from the location. It is a one-way hash that cannot be decrypted back into coordinates, but allows determining if users are in the same region.

##### Friends Endpoints

- **POST** `/v1/friends/add`

  Send a friend request to a contact or user.
  
  **Query Parameters**: 
  - `user` (string, required) - User ID to send request to
  - `isContact?` (boolean, optional) - Whether this is from contacts list
  
  **Response**: 
  ```json
  {
    "success": true,
    "request_id": "string"
  }
  ```

- **GET** `/v1/friends/requests`

  List all pending friend requests (incoming and outgoing).
  
  **Response**: 
  ```json
  {
    "incoming": [
      {
        "id": "string",
        "user_id": "string",
        "username": "string",
        "created_at": "ISO8601_string"
      }
    ],
    "outgoing": [
      {
        "id": "string",
        "user_id": "string",
        "username": "string",
        "created_at": "ISO8601_string"
      }
    ]
  }
  ```

- **POST** `/v1/friends/accept`

  Accept a pending friend request.
  
  **Query Parameters**: 
  - `id` (string, required) - Friend request ID
  
  **Response**: 
  ```json
  {
    "success": true,
    "friendship_id": "string"
  }
  ```

- **DELETE** `/v1/friends/remove`

  Remove a friend or cancel a pending friend request.
  
  **Query Parameters**: 
  - `id?` (string, optional) - Friend request or friendship ID
  - `user?` (string, optional) - User ID to remove
  
  **Response**: 
  ```json
  {
    "success": true
  }
  ```

##### Contacts Endpoints

- **PUT** `/v1/contacts/set`

  Upload the user's contacts list.
  
  **Body**: 
  ```json
  {
    "contacts": [
      {
        "name": "string",
        "phone_hash": ["string"]
      }
    ],
    "length": "number",
    "timestamp": "ISO8601_string"
  }
  ```
  
  **Response**: 
  ```json
  {
    "success": true,
    "matched_users": ["user_id"]
  }
  ```

- **GET** `/v1/contacts/list`

  Check the user's contact list to see which of them are also using this app. The user can send them requests.
  
  **Query Parameters**: 
  - `user?` (string, optional) - Check a specific user
  - `phone?` (string, optional) - Check a specific phone number
  
  **Response**: 
  ```json
  {
    "matched": [
      {
        "user_id": "string",
        "username": "string",
        "phone": "string",
        "contact_name": "string",
        "is_friend": "boolean"
      }
    ]
  }
  ```

**Contact Matching**: Phone numbers are normalized in the format `+Code'nPhone` (e.g. `+24123912319`) and then hashed before uploading. The server receives and compares these hashes. Privacy settings may hide some users from contact matching.

##### Messages Endpoints

- **GET** `/v1/messages/list`

  Get the user's DM list (this will include new notifications count for each DM).
  
  **Query Parameters**: 
  - `after?` (ISO8601 timestamp or message_id, optional) - Only return DMs updated after this timestamp
  
  **Response**: 
  ```json
  {
    "dms": [
      {
        "id": "string",
        "user_id": "string",
        "username": "string",
        "last_message": {
          "text": "string",
          "timestamp": "ISO8601_string"
        },
        "unread_count": "number",
        "updated_at": "ISO8601_string"
      }
    ]
  }
  ```

- **GET** `/v1/messages/:id/get`

  Get a specific DM. Will only show messages after `after` parameter. User devices are expected to have a local copy of previous messages, but they can reload from server when needed. Messages cannot be deleted. Reactions are stored separately with timestamps, and reactions happening after `after` will be listed. Each message has a unique message ID.
  
  **Query Parameters**: 
  - `after?` (ISO8601 timestamp or message_id, optional) - Only return messages/reactions after this timestamp
  
  **Response**: 
  ```json
  {
    "dm_id": "string",
    "user": {
      "id": "string",
      "username": "string"
    },
    "messages": [
      {
        "id": "string",
        "text": "string",
        "sender_id": "string",
        "timestamp": "ISO8601_string",
        "meetup_request": {
          "id": "string",
          "status": "pending|accepted|declined",
          "location": null
        }
      }
    ],
    "reactions": [
      {
        "message_id": "string",
        "reaction": "string",
        "user_id": "string",
        "timestamp": "ISO8601_string"
      }
    ]
  }
  ```

**Message ID Format**: UUID v4 or timestamp-based unique identifier.

**Polling vs WebSocket**: The app uses WebSocket for real-time notifications (new message, friend request, etc.). When a notification is received via WebSocket, the client should fetch the actual data from the API. The client polls the API periodically using the `after` parameter based on `last_fetched_timestamp` stored locally.

- **POST** `/v1/messages/:id/send`

  Send a message in a DM. Rate limited to 1 message per second per user.
  
  **Body**: 
  ```json
  {
    "text": "string (max 2000 chars)",
    "timestamp": "ISO8601_string",
    "meetup": "boolean (optional)",
    "meta": {
      "reply_to": "message_id (optional)"
    }
  }
  ```
  
  **Response**: 
  ```json
  {
    "success": true,
    "message_id": "string",
    "timestamp": "ISO8601_string"
  }
  ```

- **POST** `/v1/messages/:id/meetup`

  Send meetup location (to accept the meetup request).
  
  **Body**: 
  ```json
  {
    "location": {
      "long": "number",
      "lat": "number",
      "alt": "number (optional)"
    },
    "timestamp": "ISO8601_string",
    "meta": {
      "meetup_request_id": "string"
    }
  }
  ```
  
  **Response**: 
  ```json
  {
    "success": true,
    "meetup_id": "string"
  }
  ```

##### Media Endpoints

- **POST** `/v1/image/upload`

  Upload an image (on backend it will transfer the image to ImgBB).
  
  **Query Parameters**: 
  - `expire?` (number, optional) - Expiration time in seconds
  
  **Body**: 
  - Multipart form data with `image` field
  
  **Response**: 
  ```json
  {
    "url": "string",
    "expires_at": "ISO8601_string (if applicable)"
  }
  ```

**Image Limits**: Max file size 10MB. Supported formats: JPEG, PNG, WebP.

##### User Endpoints

- **POST** `/v1/logout`

  Logout and invalidate the current session.
  
  **Query Parameters**: 
  - `reason?` (string, optional) - Logout reason for analytics
  
  **Response**: 
  ```json
  {
    "success": true
  }
  ```

### Express WebSocket App

**Purpose**: To expose a WebSocket to inform users of any changes made to the store. The user will not be able to read these changes through the WebSocket, they'll have to refetch from the main API.

**Deployment**: `wss://ws.besideu.alimad.co`

**Connection**: The user must send an initial HTTP request with `Authorization: Bearer <token>` header to authenticate. Upon successful authentication, the connection will be upgraded to WebSocket. This way we have context on which user is connected.

**Implementation**: This app can either directly await updates to Supabase using real-time subscriptions, or have a webhook integration with the NextJS backend.

#### WebSocket Message Format

**Incoming Messages (Client → Server)**:
```json
{
  "type": "location_update",
  "payload": {
    "location_hash": "string",
    "timestamp": "ISO8601_string"
  }
}
```

**Outgoing Messages (Server → Client)**:
```json
{
  "type": "new_message",
  "payload": {
    "dm_id": "string",
    "message_id": "string"
  }
}
```

**Message Types**:
- `location_update` - Client sends location updates
- `new_message` - Server notifies of new message
- `friend_request` - Server notifies of new friend request
- `friend_accepted` - Server notifies of accepted friend request
- `meetup_request` - Server notifies of meetup request
- `meetup_accepted` - Server notifies of accepted meetup with location
- `ping` / `pong` - Keep-alive messages

---

## Database Schema

The following tables will be created in Supabase:

### `users`
- `id` (UUID, primary key)
- `phone` (string, unique, indexed)
- `username` (string, unique)
- `real_name` (string)
- `firebase_uid` (string, unique, indexed) - Firebase user ID
- `email` (string, nullable)
- `email_verified` (boolean, default false)
- `preferences` (JSONB) - Contains `range` (default 5km) and other settings
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `user_locations`
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to users)
- `location_hash` (string, indexed)
- `updated_at` (timestamp, indexed)

### `friends`
- `id` (UUID, primary key)
- `user_id_1` (UUID, foreign key to users)
- `user_id_2` (UUID, foreign key to users)
- `created_at` (timestamp)
- `last_message` (string, nullable) - Denormalized last message text
- `last_message_at` (timestamp, nullable, indexed) - Time of last message
- `last_read_at_1` (timestamp, nullable) - When user_id_1 last read the chat
- `last_read_at_2` (timestamp, nullable) - When user_id_2 last read the chat
- `unread_count_1` (integer, default 0) - Unread messages for user_id_1
- `unread_count_2` (integer, default 0) - Unread messages for user_id_2
- Check constraint: `user_id_1 < user_id_2` (ensures consistent ordering)
- Unique constraint on (user_id_1, user_id_2)
- **Note**: `user_id_1` must always be the smaller UUID to prevent duplicate bidirectional friendships. Application logic must ensure this ordering when creating friendships.

### `friend_requests`
- `id` (UUID, primary key)
- `from_user_id` (UUID, foreign key to users)
- `to_user_id` (UUID, foreign key to users)
- `status` (enum: pending, accepted, declined, cancelled)
- `created_at` (timestamp)
- Unique constraint on (from_user_id, to_user_id) where status = 'pending' (prevents duplicate pending requests)

### `contacts`
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to users)
- `contacts_data` (JSONB) - Array of {name, phone[]}
- `last_synced_at` (timestamp)

### `messages`
- `id` (UUID, primary key)
- `dm_id` (UUID, indexed) - Direct message conversation ID
- `sender_id` (UUID, foreign key to users)
- `text` (string, max 2000 chars)
- `timestamp` (timestamp, indexed)
- `meetup_request_id` (UUID, nullable, foreign key to meetups)

### `message_reactions`
- `id` (UUID, primary key)
- `message_id` (UUID, foreign key to messages)
- `user_id` (UUID, foreign key to users)
- `reaction` (string) - emoji or reaction type
- `timestamp` (timestamp)

### `meetups`
- `id` (UUID, primary key)
- `dm_id` (UUID, foreign key)
- `requested_by` (UUID, foreign key to users)
- `requested_from` (UUID, foreign key to users)
- `status` (enum: pending, accepted, declined, expired)
- `location` (JSONB) - {long, lat, alt}
- `expires_at` (timestamp)
- `created_at` (timestamp)

### Row Level Security (RLS)
All tables will have RLS policies to ensure users can only access their own data and data they're authorized to see (friends, messages, etc.).

### Indexes
- `user_locations.location_hash` - For efficient hash-based queries
- `user_locations.updated_at` - For finding recently active users
- `messages.dm_id, timestamp` - Composite index for message retrieval
- `messages.sender_id, timestamp` - Composite index for rate limiting
- `friends.user_id_1, user_id_2` - For friend lookup

---

## Environment Variables

### NextJS API (`api/` or `web/app/api/`)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_EXPIRES_IN` - JWT expiration time (default: 24h)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account client email
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
- `EXPO_PUBLIC_API_URL` - API base URL (https://api.besideu.alimad.co)
- `EXPO_PUBLIC_WS_URL` - WebSocket URL ([wss://ws.besideu.alimad.co](wss://ws.besideu.alimad.co))
- `EXPO_PUBLIC_FIREBASE_API_KEY` - Firebase web API key
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID

---

## Authentication Flow

1. **Signup**: 
   - Client uses Firebase phone authentication to verify phone number
   - Firebase sends SMS verification code to user's phone
   - User enters verification code in Firebase SDK
   - Client receives Firebase ID token after successful verification
   - Client sends Firebase ID token to `/auth/signup` with username and real_name
   - Backend verifies Firebase ID token using Firebase Admin SDK
   - Backend extracts phone number from Firebase token
   - Backend creates user account in Supabase
   - Backend generates and returns JWT token for API authentication
   - User is now authenticated

2. **Login**: 
   - Client uses Firebase phone authentication to verify phone number
   - Firebase sends SMS verification code to user's phone
   - User enters verification code in Firebase SDK
   - Client receives Firebase ID token after successful verification
   - Client sends Firebase ID token to `/auth/login`
   - Backend verifies Firebase ID token using Firebase Admin SDK
   - Backend looks up user by phone number in Supabase
   - Backend generates and returns JWT token (valid for 24 hours)

3. **Protected Routes**: All `/v1/*` endpoints require JWT token in `Authorization: Bearer <token>` header
   - Token is validated on each request (not Firebase token, but API JWT token)
   - User context is extracted from JWT token payload
   - Backend connects to Supabase using service role key for data operations

4. **Token Refresh**: Not implemented in initial version. User must login again after token expires.

5. **Logout**: Token is invalidated (stored in blacklist if needed for immediate invalidation)

---

**Note**: This README will be updated as development progresses. See `TODO.md` for implementation tasks.
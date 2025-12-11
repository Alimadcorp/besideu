# BesideU - Implementation TODO

This document lists all tasks needed to complete the BesideU application, organized by category and in implementation order.

---

## 1. Project Setup & Configuration

- [ ] Set up environment variables for all three services (Supabase, JWT secrets, API keys)
- [ ] Install dependencies for NextJS API (`web/`)
- [ ] Install dependencies for Express WebSocket (`socket/`)
- [ ] Install dependencies for Expo client (`client/`)
- [ ] Configure Supabase project and obtain API keys
- [ ] Set up development environment with `.env` files
- [ ] Configure Git repository and `.gitignore` for environment files
- [ ] Set up package.json scripts for development workflow

---

## 2. Database Schema Design

- [ ] Design `users` table schema in Supabase
- [ ] Design `user_locations` table schema in Supabase
- [ ] Design `friends` table schema in Supabase
- [ ] Design `friend_requests` table schema in Supabase
- [ ] Design `contacts` table schema in Supabase
- [ ] Design `messages` table schema in Supabase
- [ ] Design `message_reactions` table schema in Supabase
- [ ] Design `meetups` table schema in Supabase
- [ ] Set up Row Level Security (RLS) policies for all tables
- [ ] Create indexes for geohash queries on `user_locations`
- [ ] Create indexes for message retrieval on `messages`
- [ ] Create indexes for friend lookups on `friends`
- [ ] Set up database functions/triggers if needed
- [ ] Test database migrations and rollback procedures

---

## 3. Backend - Authentication System

- [ ] Implement phone number signup endpoint (`POST /auth/signup`)
- [ ] Integrate WhatsApp Business API (Facebook Developers platform)
- [ ] Set up WhatsApp Business API credentials and phone number
- [ ] Implement TOTP (Time-based One-Time Password) generation
- [ ] Implement verification code endpoint (`POST /auth/verify`)
- [ ] Send TOTP codes via WhatsApp Business API
- [ ] Validate TOTP codes with time window tolerance
- [ ] Implement login endpoint (`POST /auth/login`)
- [ ] Implement password hashing (bcrypt or similar)
- [ ] Generate JWT tokens with user ID and phone in payload
- [ ] Implement JWT middleware for `/v1` routes
- [ ] Add JWT token validation and user context extraction
- [ ] Create utility functions for JWT operations
- [ ] Add email linking feature structure (future enhancement placeholder)

---

## 4. Backend - User Location System

- [ ] Research and implement Geohash library/utility functions
- [ ] Implement `PUT /v1/location/set` endpoint
- [ ] Validate Geohash format and precision
- [ ] Update user location in `user_locations` table
- [ ] Implement `GET /v1/location/find` endpoint
- [ ] Calculate Geohash-based distance between users
- [ ] Implement range filtering (kilometers)
- [ ] Add user preference default range lookup
- [ ] Optimize queries for Vercel 5-second execution limit
- [ ] Add pagination for location find results
- [ ] Test geohash accuracy and distance calculations

---

## 5. Backend - Friends System

- [ ] Implement `POST /v1/friends/add` endpoint
- [ ] Validate user exists and is not already a friend
- [ ] Create friend request in `friend_requests` table
- [ ] Prevent duplicate friend requests
- [ ] Implement `GET /v1/friends/requests` endpoint
- [ ] Return both incoming and outgoing requests
- [ ] Include user information with requests
- [ ] Implement `POST /v1/friends/accept` endpoint
- [ ] Create friendship record in `friends` table
- [ ] Update friend request status
- [ ] Implement `DELETE /v1/friends/remove` endpoint
- [ ] Handle removal of both friendships and pending requests
- [ ] Add friend status validation utilities
- [ ] Test friend request flow end-to-end

---

## 6. Backend - Contacts System

- [ ] Implement `PUT /v1/contacts/set` endpoint
- [ ] Validate contacts data structure
- [ ] Normalize phone numbers (remove spaces, dashes, handle country codes)
- [ ] Store contacts in `contacts` table
- [ ] Match contacts with existing users by phone number
- [ ] Implement `GET /v1/contacts/list` endpoint
- [ ] Return matched users with contact information
- [ ] Handle contact privacy settings
- [ ] Filter out users who have disabled contact discovery
- [ ] Test phone number normalization and matching
- [ ] Add contact sync deduplication logic

---

## 7. Backend - Messaging System

- [ ] Finalize message storage structure
- [ ] Implement DM conversation ID generation logic
- [ ] Implement `GET /v1/messages/list` endpoint
- [ ] Calculate unread message counts per DM
- [ ] Sort DMs by last message timestamp
- [ ] Implement `after` parameter filtering
- [ ] Implement `GET /v1/messages/:id/get` endpoint
- [ ] Fetch messages after specified timestamp/message_id
- [ ] Fetch reactions separately and merge with messages
- [ ] Implement message pagination
- [ ] Implement `POST /v1/messages/:id/send` endpoint
- [ ] Validate message text length (max 2000 chars)
- [ ] Implement rate limiting (1 message per second per user)
- [ ] Generate unique message IDs (UUID v4)
- [ ] Store messages in `messages` table
- [ ] Implement message reactions system
- [ ] Create `POST /v1/messages/:id/react` endpoint (optional, for reactions)
- [ ] Store reactions in `message_reactions` table
- [ ] Test message sending and retrieval
- [ ] Test rate limiting functionality

---

## 8. Backend - Meetup System

- [ ] Design meetup request flow in messages
- [ ] Implement meetup request creation in message send endpoint
- [ ] Create meetup record in `meetups` table when request is sent
- [ ] Implement `POST /v1/messages/:id/meetup` endpoint
- [ ] Validate meetup request exists and is pending
- [ ] Store exact location (lat/long/alt) for accepted meetups
- [ ] Update meetup status to accepted
- [ ] Implement meetup expiration logic (e.g., 1 hour)
- [ ] Add cleanup job/cron for expired meetups
- [ ] Send notifications via WebSocket for meetup requests
- [ ] Test meetup request and acceptance flow

---

## 9. Backend - Media Upload

- [ ] Implement `POST /v1/image/upload` endpoint
- [ ] Set up multipart form data handling
- [ ] Validate image file type (JPEG, PNG, WebP)
- [ ] Validate image file size (max 10MB)
- [ ] Process/optimize images if needed
- [ ] Integrate with ImgBB API
- [ ] Handle expiration parameter
- [ ] Return uploaded image URL
- [ ] Handle upload errors and retries
- [ ] Test image upload with various formats and sizes

---

## 10. WebSocket Server (Express)

- [ ] Set up Express server structure in `socket/`
- [ ] Install WebSocket library (ws or socket.io)
- [ ] Implement HTTP-to-WebSocket upgrade endpoint
- [ ] Implement JWT authentication on WebSocket connection
- [ ] Store connected users with their WebSocket connections
- [ ] Implement location update broadcasting to nearby users
- [ ] Set up Supabase real-time subscriptions for database changes
- [ ] Implement message notification system
- [ ] Send notifications for: new messages, friend requests, friend acceptances, meetup requests
- [ ] Implement connection lifecycle handlers (connect, disconnect, reconnection)
- [ ] Define WebSocket message protocol (message types and formats)
- [ ] Implement ping/pong keep-alive mechanism
- [ ] Handle connection errors and reconnection attempts
- [ ] Test WebSocket connection and message flow
- [ ] Test with multiple concurrent connections

---

## 11. Frontend - Project Setup

- [ ] Configure Expo app settings in `app.json`
- [ ] Set up navigation structure (Expo Router with tabs for chats/map)
- [ ] Configure location permissions in `app.json`
- [ ] Install and configure location tracking libraries
- [ ] Set up WebSocket client library
- [ ] Create API client utilities (fetch wrapper with auth headers)
- [ ] Set up token storage (Expo SecureStore)
- [ ] Create API base URL configuration
- [ ] Set up error handling utilities
- [ ] Create loading state management
- [ ] Test development build

---

## 12. Frontend - Authentication Screens

- [ ] Create signup screen UI
- [ ] Implement phone number input with validation
- [ ] Implement username and real_name inputs
- [ ] Implement password input with strength indicator
- [ ] Call `/auth/signup` API endpoint
- [ ] Create verification screen UI
- [ ] Implement TOTP code input (6-digit code from WhatsApp)
- [ ] Call `/auth/verify` API endpoint
- [ ] Store JWT token in SecureStore upon successful verification
- [ ] Create login screen UI
- [ ] Implement phone and password inputs
- [ ] Call `/auth/login` API endpoint
- [ ] Implement authentication flow navigation
- [ ] Create protected route wrapper
- [ ] Implement automatic token validation on app start
- [ ] Test authentication flow end-to-end

---

## 13. Frontend - Chats Screen

- [ ] Create chats list UI component
- [ ] Design chat list item with user info and last message
- [ ] Implement DM list fetching from `/v1/messages/list`
- [ ] Display unread message counts
- [ ] Sort chats by last message timestamp
- [ ] Implement pull-to-refresh functionality
- [ ] Create navigation to individual chat screen
- [ ] Add loading states and error handling
- [ ] Implement empty state UI
- [ ] Test chats list rendering and updates

---

## 14. Frontend - Chat Screen

- [ ] Create chat message UI component
- [ ] Design message bubble layout (sent vs received)
- [ ] Implement message list with FlatList or ScrollView
- [ ] Implement message sending functionality
- [ ] Call `/v1/messages/:id/send` API endpoint
- [ ] Implement message polling with `after` parameter
- [ ] Store `last_fetched_timestamp` locally
- [ ] Call `/v1/messages/:id/get` API endpoint periodically
- [ ] Integrate WebSocket notifications for new messages
- [ ] Update local message list when WebSocket notification received
- [ ] Implement message pagination/loading older messages
- [ ] Add meetup request button/feature in chat
- [ ] Display meetup requests in chat
- [ ] Implement meetup location sharing UI
- [ ] Implement message reactions UI (optional, if time permits)
- [ ] Handle message sending errors and retries
- [ ] Test chat functionality with multiple messages
- [ ] Test WebSocket integration for real-time updates

---

## 15. Frontend - Map/Nearby Screen

- [ ] Create nearby users list UI component
- [ ] Design user item with distance display
- [ ] Implement location fetching using device GPS
- [ ] Convert GPS coordinates to Geohash
- [ ] Call `/v1/location/set` API endpoint periodically
- [ ] Call `/v1/location/find` API endpoint
- [ ] Display distance calculations (kilometers)
- [ ] Add user filtering options (friends only, etc.)
- [ ] Display user preferences (range) in UI
- [ ] Allow user to adjust their visibility range
- [ ] Handle location permission requests
- [ ] Handle location errors and fallbacks
- [ ] Implement pull-to-refresh for nearby users
- [ ] Test location accuracy and distance display

---

## 16. Frontend - Background Services

- [ ] Implement background location tracking
- [ ] Set up location update interval (e.g., every 5 minutes)
- [ ] Throttle location updates to avoid excessive API calls
- [ ] Set up persistent WebSocket connection
- [ ] Implement WebSocket reconnection logic
- [ ] Handle app state changes (foreground/background)
- [ ] Pause/resume location updates based on app state
- [ ] Implement background task for location updates (if needed)
- [ ] Handle WebSocket disconnections and reconnections
- [ ] Test background location tracking
- [ ] Test WebSocket connection stability

---

## 17. Frontend - Friends & Contacts

- [ ] Create friends list UI screen
- [ ] Fetch and display user's friends
- [ ] Create friend requests screen UI
- [ ] Display incoming and outgoing friend requests
- [ ] Implement accept friend request functionality
- [ ] Call `/v1/friends/accept` API endpoint
- [ ] Implement decline/remove friend request functionality
- [ ] Call `/v1/friends/remove` API endpoint
- [ ] Implement contact sync functionality
- [ ] Request device contacts permission
- [ ] Format contacts data and call `/v1/contacts/set` API endpoint
- [ ] Display matched contacts from `/v1/contacts/list`
- [ ] Create add friend flow from contacts
- [ ] Call `/v1/friends/add` API endpoint
- [ ] Handle friend request notifications via WebSocket
- [ ] Update UI when friend request notifications received
- [ ] Test friends and contacts functionality

---

## 18. Testing

- [ ] Write unit tests for API endpoint handlers
- [ ] Write unit tests for authentication utilities
- [ ] Write unit tests for Geohash calculations
- [ ] Write unit tests for message rate limiting
- [ ] Write integration tests for auth flow (signup → verify → login)
- [ ] Write integration tests for friend request flow
- [ ] Write integration tests for messaging flow
- [ ] Test WebSocket connection and messaging
- [ ] Test location accuracy and geohash calculations
- [ ] Test rate limiting on message sending
- [ ] Load testing for Vercel deployment (ensure <5s execution)
- [ ] Test error handling and edge cases
- [ ] Test with multiple concurrent users
- [ ] End-to-end testing of complete user flows

---

## 19. Deployment

- [ ] Set up Vercel project for NextJS API
- [ ] Configure Vercel environment variables
- [ ] Deploy NextJS API to Vercel
- [ ] Test API endpoints in production environment
- [ ] Set up Railway project for Express WebSocket
- [ ] Configure Railway environment variables
- [ ] Deploy Express WebSocket to Railway
- [ ] Test WebSocket connection in production
- [ ] Configure domain DNS for `api.besideu.alimad.co`
- [ ] Configure domain DNS for `ws.besideu.alimad.co`
- [ ] Set up SSL certificates for both domains
- [ ] Update frontend environment variables with production URLs
- [ ] Test all endpoints with production domains
- [ ] Set up monitoring and error tracking (Sentry, etc.)
- [ ] Configure database backups in Supabase

---

## 20. Mobile App Release

- [ ] Configure EAS Build for Android in `eas.json`
- [ ] Set up Android app signing keys
- [ ] Create app icon and splash screen assets
- [ ] Prepare Google Play Store listing content
- [ ] Create app screenshots (various device sizes)
- [ ] Write app description and feature list
- [ ] Set up privacy policy and terms of service
- [ ] Configure app categories and age rating
- [ ] Build Android APK/AAB using EAS Build
- [ ] Test production build on physical devices
- [ ] Submit app to Google Play Store
- [ ] Set up release channels (internal testing, beta, production)
- [ ] Monitor app reviews and crash reports

---

## 21. Documentation & Cleanup

- [ ] Review and update README.md with any final details
- [ ] Create detailed API documentation (OpenAPI/Swagger or markdown)
- [ ] Document all API endpoints with examples
- [ ] Create deployment guide for future deployments
- [ ] Document all environment variables required
- [ ] Create troubleshooting guide for common issues
- [ ] Document database schema and relationships
- [ ] Create developer setup guide
- [ ] Add code comments for complex logic
- [ ] Clean up unused code and dependencies
- [ ] Optimize bundle sizes
- [ ] Update TODO.md to mark completed items

---

**Note**: This TODO list should be updated as tasks are completed. Check off items as you progress through implementation.
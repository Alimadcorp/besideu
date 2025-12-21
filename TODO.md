# BesideU - Implementation TODO

This document lists all tasks needed to complete the BesideU application, organized by category and in implementation order.

---

## 1. Project Setup & Configuration

- [x] Set up environment variables for all three services (Supabase, JWT secrets, API keys)
- [x] Install dependencies for NextJS API (`web/`)
- [x] Install dependencies for Express WebSocket (`socket/`)
- [x] Install dependencies for Expo client (`client/`)
- [x] Configure Supabase project and obtain API keys
- [x] Set up development environment with `.env` files
- [x] Configure Git repository and `.gitignore` for environment files
- [x] Set up package.json scripts for development workflow

---

## 2. Database Schema Design

- [x] Design `users` table schema in Supabase
- [x] Design `user_locations` table schema in Supabase
- [x] Design `friends` table schema in Supabase
- [x] Design `friend_requests` table schema in Supabase
- [x] Design `contacts` table schema in Supabase
- [x] Design `messages` table schema in Supabase
- [x] Design `message_reactions` table schema in Supabase
- [x] Design `meetups` table schema in Supabase
- [x] Set up Row Level Security (RLS) policies for all tables
- [x] Create indexes for geohash queries on `user_locations`
- [x] Create indexes for message retrieval on `messages`
- [x] Create indexes for friend lookups on `friends`
- [x] Set up database functions/triggers if needed
- [x] Test database migrations and rollback procedures

---

## 3. Backend - Authentication System

- [x] Set up Firebase Admin SDK in NextJS API
- [x] Configure Firebase service account credentials
- [x] Implement phone number signup endpoint (`POST /auth/signup`)
- [x] Verify Firebase ID token from client using Firebase Admin SDK
- [x] Extract phone number from verified Firebase token
- [x] Create user account in Supabase with Firebase UID
- [x] Implement login endpoint (`POST /auth/login`)
- [x] Verify Firebase ID token for login
- [x] Look up user by phone number or Firebase UID
- [x] Generate JWT tokens with user ID and phone in payload
- [x] Implement JWT middleware for `/v1` routes
- [x] Add JWT token validation and user context extraction
- [x] Create utility functions for JWT operations


---

## 4. Backend - User Location System

- [x] Research and implement Geohash library/utility functions
- [x] Implement `PUT /v1/location/set` endpoint
- [x] Validate Geohash format and precision
- [x] Update user location in `user_locations` table
- [x] Implement `GET /v1/location/find` endpoint
- [x] Calculate Geohash-based distance between users
- [x] Implement range filtering (kilometers)
- [x] Add user preference default range lookup
- [x] Add pagination for location find results

---

## 5. Backend - Friends System

- [x] Implement `POST /v1/friends/add` endpoint
- [x] Validate user exists and is not already a friend
- [x] Create friend request in `friend_requests` table
- [x] Prevent duplicate friend requests
- [x] Implement `GET /v1/friends/requests` endpoint
- [x] Return both incoming and outgoing requests
- [x] Include user information with requests
- [x] Implement `POST /v1/friends/accept` endpoint
- [x] Create friendship record in `friends` table
- [x] Update friend request status
- [x] Implement `DELETE /v1/friends/remove` endpoint
- [x] Handle removal of both friendships and pending requests
- [x] Add friend status validation utilities

---

## 6. Backend - Contacts System

- [x] Implement `PUT /v1/contacts/set` endpoint
- [x] Validate contacts data structure
- [x] Normalize phone numbers (remove spaces, dashes, handle country codes)
- [x] Store contacts in `contacts` table
- [x] Match contacts with existing users by phone number
- [x] Implement `GET /v1/contacts/list` endpoint
- [x] Return matched users with contact information
- [x] Add contact sync deduplication logic

---

## 7. Backend - Messaging System

- [x] Implement DM conversation ID generation logic
- [x] Implement `GET /v1/messages/list` endpoint
- [x] Calculate unread message counts per DM
- [x] Sort DMs by last message timestamp
- [x] Implement `after` parameter filtering
- [x] Implement `GET /v1/messages/:id/get` endpoint
- [x] Fetch messages after specified timestamp/message_id
- [x] Fetch reactions separately and merge with messages
- [x] Implement message pagination
- [x] Implement `POST /v1/messages/:id/send` endpoint
- [x] Validate message text length (max 2000 chars)
- [x] Implement rate limiting (1 message per second per user)
- [x] Generate unique message IDs (UUID v4)
- [x] Store messages in `messages` table
- [x] Implement message reactions system
- [x] Create `POST /v1/messages/:id/react` endpoint (optional, for reactions)
- [x] Store reactions in `message_reactions` table

---

## 8. Backend - Meetup System

- [x] Design meetup request flow in messages
- [x] Implement meetup request creation in message send endpoint (placeholder link)
- [x] Create meetup record in `meetups` table when request is sent
- [x] Implement `POST /v1/messages/:id/meetup` endpoint
- [x] Validate meetup request exists and is pending
- [x] Store exact location (lat/long/alt) for accepted meetups
- [x] Update meetup status to accepted
- [x] Implement meetup expiration logic (e.g., 1 hour)
- [x] Add cleanup job/cron for expired meetups
- [x] Send notifications via WebSocket for meetup requests

---

## 9. Backend - Media Upload

- [x] Implement `POST /v1/image/upload` endpoint
- [x] Set up multipart form data handling
- [x] Validate image file type (JPEG, PNG, WebP)
- [x] Validate image file size (max 10MB)
- [x] Process/optimize images if needed
- [x] Integrate with ImgBB API
- [x] Handle expiration parameter
- [x] Return uploaded image URL
- [x] Handle upload errors and retries

---

## 10. WebSocket Server (Express)

- [x] Set up Express server structure in `socket/`
- [x] Install WebSocket library (ws or socket.io)
- [x] Implement HTTP-to-WebSocket upgrade endpoint
- [x] Implement JWT authentication on WebSocket connection
- [x] Store connected users with their WebSocket connections
- [x] Implement location update broadcasting to nearby users
- [x] Set up Supabase real-time subscriptions for database changes
- [x] Implement message notification system
- [x] Send notifications for: new messages, friend requests, friend acceptances, meetup requests
- [x] Implement connection lifecycle handlers (connect, disconnect, reconnection)
- [x] Define WebSocket message protocol (message types and formats)
- [x] Implement ping/pong keep-alive mechanism
- [x] Handle connection errors and reconnection attempts
- [x] Test WebSocket connection and message flow
- [x] Test with multiple concurrent connections

---

## 11. Frontend - Project Setup

- [x] Configure Expo app settings in `app.json`
- [x] Set up navigation structure (Expo Router with tabs for chats/map)
- [x] Configure location permissions in `app.json`
- [x] Install and configure location tracking libraries
- [x] Set up WebSocket client library
- [x] Create API client utilities (fetch wrapper with auth headers)
- [x] Set up token storage (Expo SecureStore)
- [x] Create API base URL configuration
- [x] Set up error handling utilities
- [x] Create loading state management
- [x] Test development build

---

## 12. Frontend - Authentication Screens

- [x] Set up Firebase SDK in Expo client
- [x] Configure Firebase project credentials
- [x] Create signup screen UI
- [x] Implement phone number input with validation
- [x] Implement username and real_name inputs
- [x] Integrate Firebase phone authentication for signup
- [x] Handle Firebase SMS verification code input
- [x] Get Firebase ID token after phone verification
- [x] Call `/auth/signup` API endpoint with Firebase token
- [x] Store JWT token in SecureStore upon successful signup
- [x] Create login screen UI
- [x] Implement phone number input
- [x] Integrate Firebase phone authentication for login
- [x] Handle Firebase SMS verification code input
- [x] Get Firebase ID token after phone verification
- [x] Call `/auth/login` API endpoint with Firebase token
- [x] Store JWT token in SecureStore upon successful login
- [x] Implement authentication flow navigation
- [x] Create protected route wrapper
- [x] Implement automatic token validation on app start
- [x] Test authentication flow end-to-end

---

## 13. Frontend - Chats Screen

- [x] Create chats list UI component
- [x] Design chat list item with user info and last message
- [x] Implement DM list fetching from `/v1/messages/list`
- [x] Display unread message counts
- [x] Sort chats by last message timestamp
- [x] Implement pull-to-refresh functionality
- [x] Create navigation to individual chat screen
- [x] Add loading states and error handling
- [x] Implement empty state UI
- [x] Test chats list rendering and updates

---

## 14. Frontend - Chat Screen

- [x] Create chat message UI component
- [x] Design message bubble layout (sent vs received)
- [x] Implement message list with FlatList or ScrollView
- [x] Implement message sending functionality
- [x] Call `/v1/messages/:id/send` API endpoint
- [x] Implement message polling with `after` parameter
- [x] Store `last_fetched_timestamp` locally
- [x] Call `/v1/messages/:id/get` API endpoint periodically
- [x] Integrate WebSocket notifications for new messages
- [x] Update local message list when WebSocket notification received
- [x] Implement message pagination/loading older messages
- [x] Add meetup request button/feature in chat
- [x] Display meetup requests in chat
- [x] Implement meetup location sharing UI
- [x] Implement message reactions UI (optional, if time permits)
- [x] Handle message sending errors and retries
- [x] Test chat functionality with multiple messages
- [x] Test WebSocket integration for real-time updates

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
- [ ] Set up location update interval (e.g., every 1 minutes)
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
- [ ] Write integration tests for auth flow (signup → login)
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

## [ ] We are now reach production.

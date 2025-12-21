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

- [ ] Set up Firebase SDK in Expo client
- [ ] Configure Firebase project credentials
- [ ] Create signup screen UI
- [ ] Implement phone number input with validation
- [ ] Implement username and real_name inputs
- [ ] Integrate Firebase phone authentication for signup
- [ ] Handle Firebase SMS verification code input
- [ ] Get Firebase ID token after phone verification
- [ ] Call `/auth/signup` API endpoint with Firebase token
- [ ] Store JWT token in SecureStore upon successful signup
- [ ] Create login screen UI
- [ ] Implement phone number input
- [ ] Integrate Firebase phone authentication for login
- [ ] Handle Firebase SMS verification code input
- [ ] Get Firebase ID token after phone verification
- [ ] Call `/auth/login` API endpoint with Firebase token
- [ ] Store JWT token in SecureStore upon successful login
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

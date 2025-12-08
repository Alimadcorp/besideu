# BesideU

**App name**: BesideU

**Logo**: **BU**

**App tagline**: _Wo line maarne waale uncle zara bahir gaye hain_

**TODO** Make this thing finished, as I dont have enough knowledge yet of all this.

The main purpose of this app is to connect user physically. They must be location aware of each other. App will work similar to facebook where you can add friends based on contacts. You can see which one of those friends are nearby (in an X kilometer radius, varying on their and other's preferences), you can chat with those friends. You can send meetup requests to those friends to make them send their exact location. 

---

Structure:

`client`: Contains the Frontend Expo.dev client code (co.alimad.besideu)

`web`: Do not touch, contains a NextJS app for advertisement (https://besideu.alimad.co)

`api`: Contains NextJS backend (https://api.besideu.alimad.co)

`socket`: Contains Express backend (https://ws.besideu.alimad.co)

---

# Frontend
## Technologies:
  - Expo.dev (React Native)
## Deployment:
  - Will be released as Android-only app on Google Play Store
### Layout:
There will be two main pages. `chats` and `map`

Then there will be the `chat` lahout which of course will be a chatting client. You can send see recieve messages. The user will poll new messages based on last_fetched_timestamp. The user will be updated about new messages through websocket. The user will fetch the new messages through the API still.

The app will run a websocket connection always in the background, updating the user's current location to the backend, and awaiting any new message notifications.

**Chats**

It will have chats list, user can open any one chat and send or recieve messages. User can send a `meetup` request in order to ask the other user for their exact location for a meetup.

**Map**

It will not show a map, it will show a list of the nearby users. User can only see his distance from them, based on Geohash

---

# Backend
## Technologies:
  - NextJS as backend API
  - Supabase as storage and operations
  - One separate express app for WebSocket
## Deployment:
  - NextJS app must be deployable on Vercel (Operations must be optimized to run within at most 5 seconds)
  - Express app will temporarily deploy on Railway.app
## Apps
### NextJS App:
This app will work on the app router, and will expose many API methods to allow users to perform operations. We will store only the Geohash of all the users in the server, and use that to find neighboring users. We can use the exact location only when a `meetup` is requested.

**API** (REST https://api.besideu.alimad.co):

- `/auth`

  The app will authenticate users based on phone number only. Later on you can link your Email to your account (by email verification).

  - **POST** `/signup`

    Body: { phone, username, real_name, password }
    
    Response: { necessary_data? } || { error }
  - **POST** `/verify`

    Body: { phone, code }
    
    Response: { verified? } || { error }
  - **POST** `/login`

    Body: { phone, password }

    Response: { token }
- `/v1`

  The entire v1 route will be secured by JWT Bearer Authentication. The current_user will be resolved by reading their verified token. Each of these requests will have `Authorization: Bearer Token` in their headers.

  - **PUT** `/location/set` Set your location (store the user's GEO hash only in the server)
  
    Body: { geohash, timestamp, meta?: { upload_reason?, attempt_no? } }
  - **GET** `/location/find` Get other users in your `range` (kilometers) based on GEO hash distance
    
    Params: `range?` (if none, default to current_user.preference.range), `filter?`
  - **GET** `/friends/add` Send a friend request to a contact

    Params: `user`, `isContact?`
  - **GET** `/friends/requests` List all pending friend requests (their `id`s too)
  - **GET** `/friends/accept` Accept a pending friend request (each request has an `id`)

    Params: `id`
  - **GET** `/friends/remove` Remove a friend or cancel a pending friend request

    Params: `id?`, `user?`
  - **PUT** `/contacts/set` Upload the user's contacts list

    Body: { contacts: [ { name, phone:[] } ], length, timestamp }
  - **GET** `/contacts/list` Check the user's contact list to see which of them are also using this app, the user can send them requests

    Params: `user?`, `phone?` (to check a specific user or contact)
  - **GET** `/messages/list` Get the user's DM list (this will include new notifications count for each DM)

    Params: `after`
  - **GET** `/messages/:id/get` Get a specific DM (will include info, and will only show anything after `after` we expect user devices to have a local copy of the previous messages, but they can reload again from server when they want, messages cannot be deleted, but any reactions added to a message will go into a separate collection / will be on each message, but have their timestamp, and any reactions happening after `after` will be listed. Each message has a message ID to track)

    Params: `after`
  - **POST** `/messages/:id/send` Send a message (max 1 per second)

    Body: { text (limit to 2000 chars length), timestamp, meetup?, meta? }
  - **POST** `/messages/:id/meetup` Send meetup location (to accept the meetup request)

    Body: { location: { long, lat, alt }, timestamp, meta? }
  - **POST** `/image/upload` Upload an image (on backend it will transfer the image to imagbb)

    Params: `expire?`

    Response: { url }
  - **GET** `/logout`
    
    Params: `reason?`

### Express App:
Purpose: To expose a websocket to inform users of any changes made to the store, the user will not be able to read these changes through the websocket through, they'll have to refetch from the main API. Deployed at (wss://ws.besideu.alimad.co). The user will have to send a / request with `Authorization: Bearer token` in order to connect, then their connection will be upgraded. This way we will have context on which user is connected. This app can now either directly await udpdates to the Supabase, or have a webhook with the NextJS backend.

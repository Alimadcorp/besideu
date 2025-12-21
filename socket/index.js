import express from 'express';
import expressWs from 'express-ws';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables locally
if (fs.existsSync('.env')) {
  const envConfig = fs.readFileSync('.env').toString();
  for (const line of envConfig.split('\n')) {
    const [key, val] = line.split('=');
    if (key && val) {
      process.env[key.trim()] = val.trim();
    }
  }
}

const PORT = process.env.PORT || 2999;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const app = express();
const wsInstance = expressWs(app);

// Clients map: userId -> Set<WebSocket>
const textClients = new Map();

// Authentication Helper
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

app.use(express.json());

// WebSocket Endpoint
app.ws('/', (ws, req) => {
  let user = null;

  // Authenticate
  // Try Authorization header first (if supported by client/proxy)
  let token = req.headers['authorization']?.replace('Bearer ', '');
  // Fallback to query param
  if (!token && req.query?.token) {
    token = req.query.token;
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.sub) { // Assuming 'sub' is user_id, or payload.id
       user = decoded;
    } else if (decoded && decoded.id) {
       user = decoded;
    }
  }

  if (!user) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  const userId = user.id || user.sub;
  console.log(`User connected: ${userId} (${user.username || 'unknown'})`);

  if (!textClients.has(userId)) {
    textClients.set(userId, new Set());
  }
  textClients.get(userId).add(ws);

  // Setup Ping/Pong
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      
      // Handle Location Update
      if (data.type === 'location_update' && data.payload) {
        const { geohash } = data.payload;
        if (geohash) {
           const { error } = await supabase
             .from('user_locations')
             .upsert({ 
               user_id: userId, 
               geohash, 
               updated_at: new Date().toISOString() 
             });
           
           if (error) console.error('Location update failed', error);
        }
      }
      
      // Handle other client messages if needed
    } catch (err) {
      console.error('Invalid message', err);
    }
  });

  ws.on('close', () => {
    if (textClients.has(userId)) {
      textClients.get(userId).delete(ws);
      if (textClients.get(userId).size === 0) {
        textClients.delete(userId);
      }
    }
    console.log(`User disconnected: ${userId}`);
  });
});

// Ping Interval
const interval = setInterval(() => {
  wsInstance.getWss().clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wsInstance.getWss().on('close', () => {
  clearInterval(interval);
});


// Realtime Subscriptions
// We need to listen to DB changes and forward to connected clients.
// Note: Realtime via supubaes-js usually works on the CLIENT side. 
// On Server side (`supabase-js` in Node), we can also subscribe if Realtime is enabled on the table.
// Ensure "Replication" is enabled for tables in Supabase Dashboard.

const handleRealtime = () => {
  // 1. Messages
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      const newMsg = payload.new;
      const dmId = newMsg.dm_id;

      // We need to know who to notify.
      // Query friends table for dm_id using Admin client
      const { data: friendRow, error } = await supabase
         .from('friends')
         .select('user_id_1, user_id_2')
         .eq('id', dmId)
         .single();
      
      if (friendRow) {
         const { user_id_1, user_id_2 } = friendRow;
         const targets = [user_id_1, user_id_2];
         
         const notification = JSON.stringify({
            type: 'new_message',
            payload: {
               dm_id: dmId,
               message_id: newMsg.id
            }
         });

         targets.forEach(uid => {
            if (uid && textClients.has(uid)) {
               textClients.get(uid).forEach(client => {
                  if (client.readyState === 1) client.send(notification);
               });
            }
         });
      }
    })
    .subscribe();

  // 2. Friend Requests
  supabase
    .channel('public:friend_requests')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests' }, (payload) => {
       const newReq = payload.new;
       if (newReq.status === 'pending') {
          const target = newReq.to_user_id;
          if (target && textClients.has(target)) {
             textClients.get(target).forEach(client => {
                if (client.readyState === 1) client.send(JSON.stringify({
                   type: 'friend_request',
                   payload: { id: newReq.id }
                }));
             });
          }
       }
    })
    .subscribe();

   // 3. Friend Accepted (UPDATE on friend_requests or INSERT on friends)
   // Usually INSERT on friends is better indicator of success.
   supabase
    .channel('public:friends')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friends' }, (payload) => {
       const newFriend = payload.new;
       const targets = [newFriend.user_id_1, newFriend.user_id_2];
       targets.forEach(uid => {
          if (uid && textClients.has(uid)) {
             textClients.get(uid).forEach(client => {
                if (client.readyState === 1) client.send(JSON.stringify({
                   type: 'friend_accepted',
                   payload: { friendship_id: newFriend.id }
                }));
             });
          }
       });
    })
    .subscribe();

    // 4. Meetups
    supabase
    .channel('public:meetups')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups' }, async (payload) => {
       const record = payload.new || payload.old; // handle updates
       if (!record) return;
       // Notify both parties.
       // We need DM participants or query meetups -> dm_id -> friends
       // Or `requested_by` and `requested_from` are in `meetups` table? 
       // Yes, I verified `meetups` has `requested_by` and `requested_from`.
       
       const targets = [record.requested_by, record.requested_from];
       const type = payload.eventType === 'INSERT' ? 'meetup_request' : 'meetup_update';

       const notification = JSON.stringify({
          type,
          payload: { 
             meetup_id: record.id,
             status: record.status
          }
       });

       targets.forEach(uid => {
          if (uid && textClients.has(uid)) {
             textClients.get(uid).forEach(client => {
                if (client.readyState === 1) client.send(notification);
             });
          }
       });
    })
    .subscribe();
};

handleRealtime();

app.listen(PORT, () => {
  console.log(`BesideU Socket running on port ${PORT}`);
});

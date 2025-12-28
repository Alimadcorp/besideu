import express from 'express';
import expressWs from 'express-ws';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import url from 'url';

// --- Environment Setup ---
const PORT = process.env.PORT || 2999;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Only load .env manually if not in production and file exists
if (NODE_ENV !== 'production' && fs.existsSync('.env')) {
  console.log('[Socket] Loading local .env file...');
  const envConfig = fs.readFileSync('.env').toString();
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valParts] = trimmed.split('=');
    const keyTrimmed = key.trim();
    const valTrimmed = valParts.join('=').trim();
    // Do NOT overwrite existing environment variables (prioritize Railway/System env)
    if (keyTrimmed && valTrimmed && !process.env[keyTrimmed]) {
      process.env[keyTrimmed] = valTrimmed;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// Debug info (safe keys only)
console.log(`[Socket] Environment: ${NODE_ENV}`);
console.log(`[Socket] Port: ${PORT}`);
console.log(`[Socket] Supabase URL: ${SUPABASE_URL ? 'PRESENT' : 'MISSING'}`);
console.log(`[Socket] Supabase Key: ${SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`[Socket] JWT Secret: ${JWT_SECRET ? 'PRESENT' : 'MISSING'}`);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.error('[Socket] FATAL: Missing required environment variables');
  // Don't exit in dev, but definitely will fail in prod
  if (NODE_ENV === 'production') process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const app = express();
// Enable express-ws
const wsInstance = expressWs(app);

// userId -> Set of WebSocket connections
const textClients = new Map();

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error(`[Socket] Token verification failed: ${err.message}`);
    return null;
  }
};

app.use(express.json());

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: NODE_ENV,
    connections: wsInstance.getWss().clients.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// --- WebSocket Handler ---
app.ws('/', (ws, req) => {
  let user = null;

  // 1. Try Authorization header
  let token = req.headers['authorization']?.replace('Bearer ', '');

  // 2. Try Sec-WebSocket-Protocol (common for some clients)
  if (!token && req.headers['sec-websocket-protocol']) {
    token = req.headers['sec-websocket-protocol'];
  }

  // 3. Try Query Params (Best fallback for RN/Web)
  if (!token) {
    const parsedUrl = url.parse(req.url, true);
    token = parsedUrl.query.token;
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      user = decoded;
    }
  }

  if (!user || (!user.id && !user.sub)) {
    console.log(`[Socket] REJECTED: Unauthorized connection attempt.`);
    ws.close(4001, 'Unauthorized');
    return;
  }

  const userId = user.id || user.sub;
  const username = user.username || 'unknown';
  console.log(`[Socket] CONNECTED: ${userId} (${username})`);

  if (!textClients.has(userId)) {
    textClients.set(userId, new Set());
  }
  textClients.get(userId).add(ws);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'location_update' && data.payload) {
        const { location_hash } = data.payload;
        if (location_hash) {
          const { error } = await supabase
            .from('user_locations')
            .upsert({
              user_id: userId,
              location_hash,
              updated_at: new Date().toISOString()
            });
          if (error) console.error('[Socket] DB ERROR: location_update', error);
        }
      }
    } catch (err) {
      console.error('[Socket] ERROR: Invalid JSON message', err);
    }
  });

  ws.on('close', (code, reason) => {
    if (textClients.has(userId)) {
      textClients.get(userId).delete(ws);
      if (textClients.get(userId).size === 0) {
        textClients.delete(userId);
      }
    }
    console.log(`[Socket] DISCONNECTED: ${userId} (Code: ${code}, Reason: ${reason})`);
  });

  ws.on('error', (err) => {
    // console.error(`[Socket] ERROR for user ${userId}:`, err);
  });
});

// Ping interval (30s)
const interval = setInterval(() => {
  wsInstance.getWss().clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[Socket] PRUNING: Terminating inactive connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wsInstance.getWss().on('close', () => clearInterval(interval));

// --- Supabase Realtime ---
const handleRealtime = () => {
  console.log('[Socket] Initializing Supabase Realtime...');

  // Helper to send to specific user
  const notifyUser = (uid, data) => {
    if (uid && textClients.has(uid)) {
      const message = JSON.stringify(data);
      textClients.get(uid).forEach(client => {
        if (client.readyState === 1) client.send(message);
      });
    }
  };

  // 1. Messages
  supabase
    .channel('messages-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      const newMsg = payload.new;
      console.log(`[Socket] NOTIFY: Message in DM ${newMsg.dm_id}`);

      const { data: friendRow } = await supabase
        .from('friends')
        .select('user_id_1, user_id_2')
        .eq('id', newMsg.dm_id)
        .single();

      if (friendRow) {
        const targets = [friendRow.user_id_1, friendRow.user_id_2];
        targets.forEach(uid => notifyUser(uid, {
          type: 'new_message',
          payload: {
            dm_id: newMsg.dm_id,
            message_id: newMsg.id,
            sender_id: newMsg.sender_id,
            text: newMsg.text
          }
        }));
      }
    })
    .subscribe((status) => console.log(`[Socket] SUB: messages status - ${status}`));

  // 2. Friend Requests
  supabase
    .channel('friend-requests-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests' }, (payload) => {
      const newReq = payload.new;
      if (newReq.status === 'pending') {
        console.log(`[Socket] NOTIFY: Friend request to ${newReq.to_user_id}`);
        notifyUser(newReq.to_user_id, {
          type: 'friend_request',
          payload: { id: newReq.id, from_user_id: newReq.from_user_id }
        });
      }
    })
    .subscribe();

  // 3. Friends List
  supabase
    .channel('friends-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friends' }, (payload) => {
      const newFriend = payload.new;
      const targets = [newFriend.user_id_1, newFriend.user_id_2];
      targets.forEach(uid => notifyUser(uid, {
        type: 'friend_accepted',
        payload: { friendship_id: newFriend.id }
      }));
    })
    .subscribe();

  // 4. Meetups
  supabase
    .channel('meetups-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups' }, (payload) => {
      const record = payload.new || payload.old;
      if (!record) return;
      const targets = [record.requested_by, record.requested_from];
      const type = payload.eventType === 'INSERT' ? 'meetup_request' : 'meetup_update';

      targets.forEach(uid => notifyUser(uid, {
        type,
        payload: { meetup_id: record.id, status: record.status }
      }));
    })
    .subscribe();
};

handleRealtime();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Socket] Running on port ${PORT} (0.0.0.0)`);
});

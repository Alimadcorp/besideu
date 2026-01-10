import express from 'express';
import expressWs from 'express-ws';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const app = express();
expressWs(app);

const PORT = process.env.PORT || 2999;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Store active connections: userId -> Set of WebSocket connections
const connections = new Map();

// Helper to broadcast to a specific user
function broadcastToUser(userId, message) {
  const userConnections = connections.get(userId);
  if (userConnections) {
    const messageStr = JSON.stringify(message);
    userConnections.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(messageStr);
      }
    });
  }
}

// Helper to broadcast to multiple users
function broadcastToUsers(userIds, message) {
  userIds.forEach(userId => broadcastToUser(userId, message));
}

// WebSocket endpoint
app.ws('/', async (ws, req) => {
  let userId = null;
  let heartbeatInterval = null;

  try {
    // Extract token from query or header
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      ws.close(4001, 'No token provided');
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    userId = decoded.userId || decoded.id || decoded.sub;

    if (!userId) {
      ws.close(4001, 'Invalid token');
      return;
    }

    // Add connection to map
    if (!connections.has(userId)) {
      connections.set(userId, new Set());
    }
    connections.get(userId).add(ws);

    console.log(`[WS] User ${userId} connected (${connections.get(userId).size} connections)`);

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', payload: { userId } }));

    // Setup heartbeat
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'pong':
            // Heartbeat response
            break;

          case 'location_update':
            // Update location in database
            const { location_hash_100m, location_hash_500m, location_hash_1km, location_hash_3km, location_hash_5km } = message.payload || {};

            if (location_hash_100m && location_hash_500m && location_hash_1km && location_hash_3km && location_hash_5km) {
              await supabase
                .from('user_locations')
                .upsert({
                  user_id: userId,
                  location_hash_100m,
                  location_hash_500m,
                  location_hash_1km,
                  location_hash_3km,
                  location_hash_5km,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

              // Update last_online
              await supabase
                .from('users')
                .update({ last_online: new Date().toISOString() })
                .eq('id', userId);
            }
            break;

          default:
            console.log(`[WS] Unknown message type: ${message.type}`);
        }
      } catch (err) {
        console.error('[WS] Message handling error:', err);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      if (userId && connections.has(userId)) {
        connections.get(userId).delete(ws);
        if (connections.get(userId).size === 0) {
          connections.delete(userId);
        }
        console.log(`[WS] User ${userId} disconnected`);
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] Socket error:', err);
    });

  } catch (err) {
    console.error('[WS] Connection error:', err);
    ws.close(4001, 'Authentication failed');
  }
});

// Setup Supabase realtime subscriptions
async function setupRealtimeSubscriptions() {
  // Subscribe to new messages
  supabase
    .channel('messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      const message = payload.new;

      // Get DM participants
      const { data: dm } = await supabase
        .from('friends')
        .select('user_id_1, user_id_2')
        .eq('id', message.dm_id)
        .single();

      if (dm) {
        const recipients = [dm.user_id_1, dm.user_id_2].filter(id => id !== message.sender_id);

        // Fetch sender info
        const { data: sender } = await supabase
          .from('users')
          .select('username, real_name, avatar_url')
          .eq('id', message.sender_id)
          .single();

        broadcastToUsers(recipients, {
          type: 'new_message',
          payload: {
            dm_id: message.dm_id,
            message_id: message.id,
            sender: sender,
            text: message.text,
            image_url: message.image_url,
            timestamp: message.timestamp
          }
        });
      }
    })
    .subscribe();

  // Subscribe to friend requests
  supabase
    .channel('friend_requests')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests' }, async (payload) => {
      const request = payload.new;

      const { data: fromUser } = await supabase
        .from('users')
        .select('username, real_name, avatar_url')
        .eq('id', request.from_user_id)
        .single();

      broadcastToUser(request.to_user_id, {
        type: 'friend_request',
        payload: {
          request_id: request.id,
          from_user: fromUser,
          created_at: request.created_at
        }
      });
    })
    .subscribe();

  // Subscribe to friend request updates (accepted)
  supabase
    .channel('friend_request_updates')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friend_requests' }, async (payload) => {
      const request = payload.new;

      if (request.status === 'accepted') {
        const { data: toUser } = await supabase
          .from('users')
          .select('username, real_name, avatar_url')
          .eq('id', request.to_user_id)
          .single();

        broadcastToUser(request.from_user_id, {
          type: 'friend_accepted',
          payload: {
            user: toUser,
            created_at: request.created_at
          }
        });
      }
    })
    .subscribe();

  // Subscribe to meetup requests
  supabase
    .channel('meetups')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meetups' }, async (payload) => {
      const meetup = payload.new;

      const { data: requester } = await supabase
        .from('users')
        .select('username, real_name, avatar_url')
        .eq('id', meetup.requested_by)
        .single();

      broadcastToUser(meetup.requested_from, {
        type: 'meetup_request',
        payload: {
          meetup_id: meetup.id,
          from_user: requester,
          dm_id: meetup.dm_id,
          expires_at: meetup.expires_at
        }
      });
    })
    .subscribe();

  // Subscribe to meetup updates (accepted)
  supabase
    .channel('meetup_updates')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meetups' }, async (payload) => {
      const meetup = payload.new;

      if (meetup.status === 'accepted' && meetup.location) {
        broadcastToUser(meetup.requested_by, {
          type: 'meetup_accepted',
          payload: {
            meetup_id: meetup.id,
            location: meetup.location,
            dm_id: meetup.dm_id
          }
        });
      }
    })
    .subscribe();

  // Subscribe to user statuses
  supabase
    .channel('user_statuses')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_statuses' }, async (payload) => {
      const status = payload.new;

      // Get user's friends
      const { data: friendships } = await supabase
        .from('friends')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${status.user_id},user_id_2.eq.${status.user_id}`);

      if (friendships) {
        const friendIds = friendships.map(f =>
          f.user_id_1 === status.user_id ? f.user_id_2 : f.user_id_1
        );

        const { data: user } = await supabase
          .from('users')
          .select('username, real_name, avatar_url')
          .eq('id', status.user_id)
          .single();

        broadcastToUsers(friendIds, {
          type: 'status_posted',
          payload: {
            status_id: status.id,
            user: user,
            type: status.type,
            created_at: status.created_at
          }
        });
      }
    })
    .subscribe();

  // Subscribe to meeting logs
  supabase
    .channel('meeting_logs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meeting_logs' }, async (payload) => {
      const log = payload.new;

      // Get meeting creator
      const { data: meeting } = await supabase
        .from('meetings')
        .select('creator_id, channel_id')
        .eq('id', log.meeting_id)
        .single();

      if (meeting) {
        const { data: user } = await supabase
          .from('users')
          .select('username, real_name')
          .eq('id', log.user_id)
          .single();

        broadcastToUser(meeting.creator_id, {
          type: 'meeting_update',
          payload: {
            meeting_id: log.meeting_id,
            user: user,
            event_type: log.type,
            created_at: log.created_at
          }
        });
      }
    })
    .subscribe();

  console.log('[Realtime] Subscriptions setup complete');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: connections.size,
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] WebSocket server running on port ${PORT}`);
  setupRealtimeSubscriptions();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, closing connections...');
  connections.forEach((wsSet) => {
    wsSet.forEach(ws => ws.close(1000, 'Server shutting down'));
  });
  process.exit(0);
});

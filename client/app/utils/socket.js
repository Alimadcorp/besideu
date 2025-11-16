import MadSocket from './MadSocket'; // adjust path

const socket = new MadSocket("wss://ws.alimad.co");
socket.connect();

const CHANNEL = "chat:locations";
socket.subscribe(CHANNEL);

export function broadcastLocation(userId, latitude, longitude) {
  socket.stateAdd(CHANNEL, { userId, latitude, longitude, timestamp: Date.now() });

  // Notify everyone immediately
  socket.broadcast(
    { type: 'locationUpdated', userId, latitude, longitude, timestamp: Date.now() },
    [CHANNEL]
  );
}

export async function getLocations(callback) {
  // Initial state
  const initial = await socket.stateGet(CHANNEL);
  callback(initial);

  // Listen to messages
  socket.on((msg) => {
    if (msg.type === "state" && msg.channel === CHANNEL) {
      callback(msg.data);
    }
    if (msg.type === "broadcast" && msg.channel === CHANNEL && msg.data?.type === 'locationUpdated') {
      // Re-fetch state when anyone broadcasts
      socket.stateGet(CHANNEL).then(callback);
    }
  });
}

export function setLocation(userId, coord) {
  broadcastLocation(userId, coord.latitude, coord.longitude);
}

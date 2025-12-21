import { getToken } from './storage';

let ws: WebSocket | null = null;
let reconnectInterval: NodeJS.Timeout | null = null;
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://ws.besideu.alimad.co';

type WebSocketMessage = {
    type: string;
    payload: any;
};

type MessageHandler = (message: WebSocketMessage) => void;
const listeners: MessageHandler[] = [];

export async function connectWebSocket() {
    if (typeof WebSocket === 'undefined') {
        console.log('WebSocket not available in this environment');
        return;
    }

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const token = await getToken();
    if (!token) {
        console.log('No token found, skipping WebSocket connection');
        return;
    }

    // @ts-ignore - WebSocket in React Native supports headers in 3rd argument
    ws = new WebSocket(WS_URL, [], {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    ws.onopen = () => {
        console.log('WebSocket Connected');
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };

    ws.onmessage = (e) => {
        try {
            const message = JSON.parse(e.data);
            listeners.forEach(listener => listener(message));
        } catch (err) {
            console.error('Failed to parse WebSocket message', err);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket Disconnected');
        ws = null;
        // Attempt reconnection
        if (!reconnectInterval) {
            reconnectInterval = setInterval(connectWebSocket, 5000) as any;
        }
    };

    ws.onerror = (e) => {
        console.error('WebSocket Error', e);
    };
}

export function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
}

export function addSocketListener(callback: MessageHandler) {
    listeners.push(callback);
    return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    };
}

export function sendSocketMessage(type: string, payload: any) {
    if (typeof WebSocket !== 'undefined' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    } else {
        console.warn('WebSocket not connected, cannot send message');
    }
}

// Mock functions for maps.native.tsx compatibility until fully implemented
export const setLocation = (userId: string, pos: any) => {
    // Send location update to server
    sendSocketMessage('location_update', {
        geohash: 'TODO', // We need to convert pos to geohash
        timestamp: new Date().toISOString(),
        // ... other data if protocol allows
    });
};

export const getLocations = (cb: any) => {
    // This looks like it was expecting a callback driven subscription
    // We can map specific listener types to this callback if needed
    // For now, just a placeholder
};

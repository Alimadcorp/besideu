import { getToken } from './storage';
import { hashLocation } from './crypto';

let ws: WebSocket | null = null;
let reconnectInterval: NodeJS.Timeout | null = null;

// Base WebSocket URL
const WS_URL_BASE = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:2999';

type WebSocketMessage = {
    type: string;
    payload: any;
};

type MessageHandler = (message: WebSocketMessage) => void;
const listeners: MessageHandler[] = [];

/**
 * Ensures the WebSocket URL is correctly formatted with a trailing slash and token
 */
function getFormattedUrl(token: string): string {
    // Ensure the base URL ends with a slash if it doesn't have one and doesn't have a query
    let base = WS_URL_BASE;
    if (!base.includes('?') && !base.endsWith('/')) {
        base += '/';
    }

    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(token)}`;
}

export async function connectWebSocket() {
    if (typeof WebSocket === 'undefined') {
        return;
    }

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const token = await getToken();
    if (!token) {
        // console.log('[Socket] No token, skipping connection');
        return;
    }

    try {
        const fullUrl = getFormattedUrl(token);
        // console.log(`[Socket] Connecting to ${WS_URL_BASE}...`);

        // Use a safe wrapper for WebSocket to handle potential handshake errors
        ws = new WebSocket(fullUrl);

        ws.onopen = () => {
            // console.log('[Socket] Connected Successfully');
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
                // console.error('[Socket] Parse error:', err);
            }
        };

        ws.onclose = (e) => {
            // console.log(`[Socket] Closed (Code: ${e.code}, Reason: ${e.reason || 'none'})`);
            ws = null;

            // Only reconnect if we didn't close manually and it's not an auth error (4001)
            if (!reconnectInterval && e.code !== 4001) {
                // console.log('[Socket] Scheduling reconnect...');
                reconnectInterval = setInterval(connectWebSocket, 5000);
            }
        };

        ws.onerror = (e) => {
            // Silenced error
            // console.error('[Socket] Connection error');
        };
    } catch (err) {
        // Silenced error
        // console.error('[Socket] Setup error:', err);
    }
}

export function disconnectWebSocket() {
    if (ws) {
        ws.close(1000, 'User logged out');
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
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    } else {
        // console.warn('[Socket] Message not sent: Not connected');
    }
}

export const updateSocketLocation = (lat: number, lon: number) => {
    try {
        const location_hash = hashLocation(lat, lon);
        sendSocketMessage('location_update', { location_hash });
    } catch (e) {
        // Silent fail
    }
};

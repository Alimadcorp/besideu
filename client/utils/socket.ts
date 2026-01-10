import { getToken } from './storage';
import { hashLocationAll } from './crypto';

let ws: WebSocket | null = null;
let reconnectInterval: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // Start with 1 second

// Base WebSocket URL
const WS_URL_BASE = process.env.EXPO_PUBLIC_WS_URL || 'wss://ws.besideu.alimad.co';

type WebSocketMessage = {
    type: string;
    payload: any;
};

type MessageHandler = (message: WebSocketMessage) => void;
const listeners: MessageHandler[] = [];

/**
 * Ensures the WebSocket URL is correctly formatted with token
 */
function getFormattedUrl(token: string): string {
    let base = WS_URL_BASE;

    // Remove trailing slash if present
    if (base.endsWith('/')) {
        base = base.slice(0, -1);
    }

    // Add token as query parameter
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(token)}`;
}

/**
 * Calculate exponential backoff delay
 */
function getReconnectDelay(): number {
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
    return delay + Math.random() * 1000; // Add jitter
}

export async function connectWebSocket() {
    if (typeof WebSocket === 'undefined') {
        console.log('[Socket] WebSocket not available in this environment');
        return;
    }

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const token = await getToken();
    if (!token) {
        console.log('[Socket] No token available');
        return;
    }

    try {
        const fullUrl = getFormattedUrl(token);
        console.log('[Socket] Connecting...');

        ws = new WebSocket(fullUrl);

        ws.onopen = () => {
            console.log('[Socket] Connected');
            reconnectAttempts = 0; // Reset on successful connection

            if (reconnectInterval) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
            }
        };

        ws.onmessage = (e) => {
            try {
                const message = JSON.parse(e.data);

                // Handle ping/pong
                if (message.type === 'ping') {
                    sendSocketMessage('pong', {});
                    return;
                }

                // Notify all listeners
                listeners.forEach(listener => {
                    try {
                        listener(message);
                    } catch (err) {
                        console.error('[Socket] Listener error:', err);
                    }
                });
            } catch (err) {
                console.error('[Socket] Parse error:', err);
            }
        };

        ws.onclose = (e) => {
            console.log(`[Socket] Closed (Code: ${e.code}, Reason: ${e.reason || 'none'})`);
            ws = null;

            // Don't reconnect if it's an auth error (4001) or we've hit max attempts
            if (e.code === 4001) {
                console.log('[Socket] Authentication failed, not reconnecting');
                return;
            }

            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.log('[Socket] Max reconnection attempts reached');
                return;
            }

            // Schedule reconnection with exponential backoff
            if (!reconnectInterval) {
                const delay = getReconnectDelay();
                console.log(`[Socket] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

                reconnectInterval = setTimeout(() => {
                    reconnectInterval = null;
                    reconnectAttempts++;
                    connectWebSocket();
                }, delay);
            }
        };

        ws.onerror = (e) => {
            console.error('[Socket] Connection error');
        };
    } catch (err) {
        console.error('[Socket] Setup error:', err);
    }
}

export function disconnectWebSocket() {
    if (reconnectInterval) {
        clearTimeout(reconnectInterval);
        reconnectInterval = null;
    }

    reconnectAttempts = 0;

    if (ws) {
        ws.close(1000, 'User logged out');
        ws = null;
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
        try {
            ws.send(JSON.stringify({ type, payload }));
        } catch (err) {
            console.error('[Socket] Send error:', err);
        }
    } else {
        console.warn('[Socket] Message not sent: Not connected');
    }
}

export const updateSocketLocation = (lat: number, lon: number) => {
    try {
        const hashes = hashLocationAll(lat, lon);
        sendSocketMessage('location_update', {
            location_hash_100m: hashes.location_hash_100m,
            location_hash_500m: hashes.location_hash_500m,
            location_hash_1km: hashes.location_hash_1km,
            location_hash_3km: hashes.location_hash_3km,
            location_hash_5km: hashes.location_hash_5km,
        });
    } catch (e) {
        console.error('[Socket] Location update error:', e);
    }
};

/**
 * Check if WebSocket is currently connected
 */
export function isSocketConnected(): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN;
}

/**
 * Get current connection state
 */
export function getSocketState(): string {
    if (!ws) return 'CLOSED';
    switch (ws.readyState) {
        case WebSocket.CONNECTING: return 'CONNECTING';
        case WebSocket.OPEN: return 'OPEN';
        case WebSocket.CLOSING: return 'CLOSING';
        case WebSocket.CLOSED: return 'CLOSED';
        default: return 'UNKNOWN';
    }
}

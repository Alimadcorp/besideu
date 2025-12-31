import { getToken } from './storage';
import * as Location from 'expo-location';
import { hashLocationAll } from './crypto';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.besideu.alimad.co';

let chatsInterval: any = null;
let locationInterval: any = null;
let isRunning = false;

export async function startBackgroundUpdater(onChatsUpdate?: (chats: any[]) => void) {
    if (isRunning) return;
    isRunning = true;

    // Fetch chats every 30 seconds
    chatsInterval = setInterval(async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch(`${API_URL}/v1/messages/list`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (onChatsUpdate && data.dms) {
                    onChatsUpdate(data.dms);
                }
            }
        } catch (e) {
            console.error('Background chats fetch failed', e);
        }
    }, 30000); // 30 seconds

    // Update location every 1 minute
    locationInterval = setInterval(async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const location = await Location.getCurrentPositionAsync({});
            const hashes = hashLocationAll(location.coords.latitude, location.coords.longitude);

            await fetch(`${API_URL}/v1/location/set`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    location_hash_100m: hashes.location_hash_100m,
                    location_hash_500m: hashes.location_hash_500m,
                    location_hash_1km: hashes.location_hash_1km,
                    location_hash_3km: hashes.location_hash_3km,
                    location_hash_5km: hashes.location_hash_5km,
                    timestamp: new Date().toISOString(),
                    meta: { upload_reason: 'background_interval' }
                })
            });
        } catch (e) {
            console.error('Background location update failed', e);
        }
    }, 60000); // 1 minute
}

export function stopBackgroundUpdater() {
    if (chatsInterval) {
        clearInterval(chatsInterval);
        chatsInterval = null;
    }
    if (locationInterval) {
        clearInterval(locationInterval);
        locationInterval = null;
    }
    isRunning = false;
}


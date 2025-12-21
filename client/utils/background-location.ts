import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import geohash from 'ngeohash';
import { getToken } from '@/utils/storage';

const LOCATION_TASK_NAME = 'background-location-task';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.besideu.alimad.co';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('Background location task error:', error);
        return;
    }
    if (data) {
        const { locations } = data as any;
        const location = locations[0];
        if (location) {
            try {
                const token = await getToken();
                if (!token) return;

                const hash = geohash.encode(location.coords.latitude, location.coords.longitude);

                await fetch(`${API_URL}/v1/location/set`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        geohash: hash,
                        timestamp: new Date().toISOString(),
                        meta: { upload_reason: 'background' }
                    })
                });
            } catch (e) {
                console.error('Background location update failed', e);
            }
        }
    }
});

export { LOCATION_TASK_NAME };

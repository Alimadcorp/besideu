import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { hashLocationAll } from '@/utils/crypto';
import { getToken } from '@/utils/storage';

const LOCATION_TASK_NAME = 'background-location-task';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.besideu.alimad.co';

// Configure Notifications Handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Background location task - runs even when app is closed
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

                const hashes = hashLocationAll(location.coords.latitude, location.coords.longitude);

                // Only send 3km hash, matching the maps.native.tsx implementation
                const response = await fetch(`${API_URL}/v1/location/set`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        location_hash_3km: hashes.location_hash_3km,
                        timestamp: new Date().toISOString(),
                    })
                });

                if (!response.ok) {
                    console.error('Background location update failed:', response.status);
                } else {
                    console.log('Background location updated successfully');
                }
            } catch (e) {
                console.error('Background location update failed', e);
            }
        }
    }
});


/**
 * Start background location tracking
 * Configured to work even when app is closed
 */
export async function startBackgroundLocationTracking() {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission not granted');
        return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
        console.log('Background location permission not granted');
        return false;
    }

    const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isTaskDefined) {
        console.error('Background location task not defined');
        return false;
    }

    // High accuracy for better "BesideU" experience
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000,   // Every 30 seconds
        distanceInterval: 30,  // Every 30 meters
        foregroundService: {
            notificationTitle: 'BesideU Location Active',
            notificationBody: 'Your location is being shared with friends nearby.',
            notificationColor: '#007AFF',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        // Android specific
        deferredUpdatesInterval: 30000,
        deferredUpdatesDistance: 30,
    });

    console.log('Background location tracking started (Frequent Updates)');
    return true;
}

/**
 * Stop background location tracking
 */
export async function stopBackgroundLocationTracking() {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('Background location tracking stopped');
    }
}



export async function requestNotificationPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    return finalStatus === 'granted';
}

export { LOCATION_TASK_NAME };

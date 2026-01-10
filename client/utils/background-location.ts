import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { hashLocationAll } from '@/utils/crypto';
import { getToken } from '@/utils/storage';

const LOCATION_TASK_NAME = 'background-location-task';
const BACKGROUND_FETCH_TASK = 'background-message-fetch';
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

                const response = await fetch(`${API_URL}/v1/location/set`, {
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
                        meta: { upload_reason: 'background' }
                    })
                });

                if (!response.ok) {
                    console.error('Background location update failed:', response.status);
                }
            } catch (e) {
                console.error('Background location update failed', e);
            }
        }
    }
});

// Background fetch task for messages
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    try {
        const token = await getToken();
        if (!token) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const response = await fetch(`${API_URL}/v1/messages/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            return BackgroundFetch.BackgroundFetchResult.Failed;
        }

        const data = await response.json();
        const dms = data.dms || [];

        // Calculate total unread
        let totalUnread = 0;
        let recentSender = '';

        for (const chat of dms) {
            if (chat.unread_count > 0) {
                totalUnread += chat.unread_count;
                if (!recentSender) recentSender = chat.real_name || chat.username;
            }
        }

        await Notifications.setBadgeCountAsync(totalUnread);

        if (totalUnread > 0) {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'New Messages',
                    body: `You have ${totalUnread} unread messages${recentSender ? ` (from ${recentSender}...)` : ''}`,
                    data: { url: '/(tabs)' },
                },
                trigger: null,
            });
            return BackgroundFetch.BackgroundFetchResult.NewData;
        }

        return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
        console.error('Background fetch failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
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

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000, // Update every 60 seconds
        distanceInterval: 100, // Or every 100 meters
        foregroundService: {
            notificationTitle: 'BesideU Location',
            notificationBody: 'Sharing your location with friends',
            notificationColor: '#007AFF',
        },
        pausesUpdatesAutomatically: false, // Keep running even when stationary
        showsBackgroundLocationIndicator: true,
    });

    console.log('Background location tracking started');
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

export async function registerBackgroundFetchAsync() {
    return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 15, // 15 minutes
        stopOnTerminate: false, // Continue after app is closed (Android)
        startOnBoot: true, // Start on device boot (Android)
    });
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

export { LOCATION_TASK_NAME, BACKGROUND_FETCH_TASK };

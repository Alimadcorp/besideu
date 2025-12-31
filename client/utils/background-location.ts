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
    }),
});

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
                        meta: { upload_reason: 'background' }
                    })
                });
            } catch (e) {
                console.error('Background location update failed', e);
            }
        }
    }
});

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
            // Check if we should notify (simple throttle could be added here if needed)
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'New Messages',
                    body: `You have ${totalUnread} unread messages${recentSender ? ` (from ${recentSender}...)` : ''}`,
                    data: { url: '/(tabs)' },
                },
                trigger: null, // Show immediately
            });
            return BackgroundFetch.BackgroundFetchResult.NewData;
        }

        return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
        console.error('Background fetch failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export async function registerBackgroundFetchAsync() {
    return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 15, // 15 minutes
        stopOnTerminate: false, // Android
        startOnBoot: true, // Android
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

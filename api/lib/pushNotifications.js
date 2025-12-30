import { Expo } from 'expo-server-sdk';
import { supabaseAdmin } from './supabaseClient';

const expo = new Expo();

/**
 * Send a push notification to a specific user
 * @param {string} userId - The Supabase user ID
 * @param {Object} message - The message object (title, body, data)
 */
export async function sendPushNotification(userId, { title, body, data }) {
    try {
        // 1. Fetch user's push token
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('expo_push_token')
            .eq('id', userId)
            .single();

        if (error || !user?.expo_push_token) {
            return;
        }

        const pushToken = user.expo_push_token;

        // 2. Check if it's a valid Expo push token
        if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`Push token ${pushToken} is not a valid Expo push token`);
            return;
        }

        // 3. Construct the message
        const messages = [{
            to: pushToken,
            sound: 'default',
            title,
            body,
            data: data || {},
        }];

        // 4. Send the notification
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            try {
                await expo.sendPushNotificationsAsync(chunk);
            } catch (error) {
                console.error('[push] Error sending chunk', error);
            }
        }
    } catch (err) {
        console.error('[push] Unexpected error', err);
    }
}

/**
 * Send push notifications to multiple users
 * @param {Array<string>} userIds 
 * @param {Object} message 
 */
export async function sendPushNotifications(userIds, { title, body, data }) {
    if (!userIds || userIds.length === 0) return;

    try {
        const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('id, expo_push_token')
            .in('id', userIds);

        if (error || !users) return;

        const messages = [];
        for (const user of users) {
            if (user.expo_push_token && Expo.isExpoPushToken(user.expo_push_token)) {
                messages.push({
                    to: user.expo_push_token,
                    sound: 'default',
                    title,
                    body,
                    data: data || {},
                });
            }
        }

        if (messages.length === 0) return;

        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            try {
                await expo.sendPushNotificationsAsync(chunk);
            } catch (error) {
                console.error('[push] Error sending chunk', error);
            }
        }
    } catch (err) {
        console.error('[push] Multi-send error', err);
    }
}

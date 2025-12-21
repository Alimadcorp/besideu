import { Stack } from 'expo-router';
import React from 'react';

export default function FriendsLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Friends' }} />
            <Stack.Screen name="requests" options={{ title: 'Friend Requests' }} />
        </Stack>
    );
}

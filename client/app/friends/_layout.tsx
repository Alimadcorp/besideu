import { Stack } from 'expo-router';
import React from 'react';

export default function FriendsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="requests" />
        </Stack>
    );
}

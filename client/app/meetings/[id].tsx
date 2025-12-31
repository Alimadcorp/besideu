import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { apiRequest } from '@/utils/api';

export default function MeetingDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const [meeting, setMeeting] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchMeeting();
    }, [id]);

    async function fetchMeeting() {
        try {
            const data = await apiRequest(`/v1/meetings/${id}`);
            if (data.meeting) {
                setMeeting(data.meeting);
            }
        } catch (error) {
            console.error('Failed to fetch meeting', error);
            Alert.alert('Error', 'Failed to load meeting details');
        } finally {
            setLoading(false);
        }
    }

    const handleRespond = async (status: 'accepted' | 'declined') => {
        setActionLoading(true);
        try {
            await apiRequest(`/v1/meetings/${id}/respond`, {
                method: 'POST',
                body: JSON.stringify({ status })
            });
            fetchMeeting(); // Refresh
        } catch (error) {
            Alert.alert('Error', 'Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckIn = async () => {
        setActionLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Location is required to check in');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});

            const response = await apiRequest(`/v1/meetings/${id}/check-arrival`, {
                method: 'POST',
                body: JSON.stringify({
                    lat: loc.coords.latitude,
                    lon: loc.coords.longitude
                })
            });

            if (response.arrived) {
                Alert.alert('Success', 'You have checked in!');
                fetchMeeting();
            } else {
                Alert.alert('Not Close Enough', `You need to be within ${meeting.threshold_km}km`);
            }
        } catch (error) {
            Alert.alert('Error', 'Check-in failed');
        } finally {
            setActionLoading(false);
        }
    };

    const openMap = () => {
        if (!meeting?.location) return;
        const { lat, lon, name } = meeting.location;
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${lat},${lon}`;
        const label = name || 'Meeting Location';
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });
        if (url) Linking.openURL(url);
    };

    if (loading) {
        return (
            <ThemedView style={styles.center}>
                <ActivityIndicator size="large" color={theme.tint} />
            </ThemedView>
        );
    }

    if (!meeting) {
        return (
            <ThemedView style={styles.center}>
                <ThemedText>Meeting not found</ThemedText>
            </ThemedView>
        );
    }

    const isCreator = meeting.role === 'creator';
    const isInvited = meeting.role === 'invited';
    const status = meeting.invitation_status;

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ title: 'Meeting Details' }} />
            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.header}>
                    <ThemedText type="title">{meeting.title}</ThemedText>

                    {meeting.participation_status === 'arrived' && (
                        <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
                            <ThemedText style={styles.badgeText}>Arrived</ThemedText>
                        </View>
                    )}
                </View>

                {meeting.description && (
                    <ThemedText style={styles.description}>{meeting.description}</ThemedText>
                )}

                <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.icon + '20' }]}>
                    <View style={styles.row}>
                        <IconSymbol size={20} name="calendar" color={theme.icon} />
                        <View>
                            <ThemedText style={styles.label}>Start</ThemedText>
                            <ThemedText>{format(new Date(meeting.starts_at), 'MMM d, yyyy - h:mm a')}</ThemedText>
                        </View>
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.row}>
                        <IconSymbol size={20} name="clock.fill" color={theme.icon} />
                        <View>
                            <ThemedText style={styles.label}>End</ThemedText>
                            <ThemedText>{meeting.ends_at ? format(new Date(meeting.ends_at), 'MMM d, yyyy - h:mm a') : 'TBD'}</ThemedText>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.card, { backgroundColor: theme.background, borderColor: theme.icon + '20' }]}
                    onPress={openMap}
                >
                    <View style={styles.row}>
                        <IconSymbol size={24} name="location.fill" color={theme.tint} />
                        <View style={{ flex: 1 }}>
                            <ThemedText type="defaultSemiBold">{meeting.location.name}</ThemedText>
                            <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>Tap to view on map</ThemedText>
                        </View>
                        <IconSymbol size={20} name="chevron.right" color={theme.icon} />
                    </View>
                </TouchableOpacity>

                {/* Actions */}
                <View style={styles.actions}>
                    {isInvited && status === 'pending' && (
                        <View style={styles.inviteActions}>
                            <TouchableOpacity
                                style={[styles.btn, styles.acceptBtn]}
                                onPress={() => handleRespond('accepted')}
                                disabled={actionLoading}
                            >
                                <ThemedText style={styles.btnText}>Accept</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btn, styles.declineBtn]}
                                onPress={() => handleRespond('declined')}
                                disabled={actionLoading}
                            >
                                <ThemedText style={styles.btnText}>Decline</ThemedText>
                            </TouchableOpacity>
                        </View>
                    )}

                    {(status === 'accepted' || isCreator) && (
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: theme.tint }]}
                            onPress={handleCheckIn}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <ThemedText style={styles.btnText}>Check In at Location</ThemedText>
                            )}
                        </TouchableOpacity>
                    )}

                    {meeting.channel_id && (
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: theme.text, marginTop: 10 }]}
                            onPress={() => router.push(`/chats/${meeting.channel_id}?type=meeting`)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <IconSymbol name="bubble.left.fill" size={20} color={theme.background} />
                                <ThemedText style={[styles.btnText, { color: theme.background }]}>Open Group Chat</ThemedText>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

            </ScrollView>
        </ThemedView>
    );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
        gap: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    description: {
        fontSize: 16,
        opacity: 0.8,
        lineHeight: 24,
    },
    card: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 16,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(150,150,150,0.2)',
    },
    label: {
        fontSize: 12,
        opacity: 0.6,
        marginBottom: 2,
    },
    actions: {
        marginTop: 20,
        gap: 10,
    },
    inviteActions: {
        flexDirection: 'row',
        gap: 10,
    },
    btn: {
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
    },
    acceptBtn: {
        backgroundColor: '#4CAF50',
    },
    declineBtn: {
        backgroundColor: '#F44336',
    },
    btnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

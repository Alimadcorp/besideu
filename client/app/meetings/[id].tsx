import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Switch, Platform, FlatList } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import MapView, { Marker, Circle } from 'react-native-maps';

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
    const [activeTab, setActiveTab] = useState<'overview' | 'live' | 'logs'>('overview');
    const [isTracking, setIsTracking] = useState(false);

    // Refresh interval refs
    const pollRef = useRef<any>(undefined);
    const trackRef = useRef<any>(undefined);

    useEffect(() => {
        fetchMeeting();
        return () => {
            clearInterval(pollRef.current);
            clearInterval(trackRef.current);
            stopLocationTracking();
        };
    }, [id]);

    useEffect(() => {
        if (!meeting) return;

        const now = new Date();
        const start = new Date(meeting.starts_at);
        const end = meeting.ends_at ? new Date(meeting.ends_at) : new Date(start.getTime() + 3 * 3600000);

        // Window: 3 hours before start to 3 hours after end
        const windowStart = new Date(start.getTime() - 3 * 3600000);
        const windowEnd = new Date(end.getTime() + 3 * 3600000);
        const isActive = now >= windowStart && now <= windowEnd;

        // Creator Polling
        if (meeting.is_creator && isActive) {
            startPolling();
        }

        // Attendee Tracking
        if (!meeting.is_creator && meeting.invitation_status === 'accepted' && isActive) {
            startTracking();
        }

        // Clean up
        return () => {
            clearInterval(pollRef.current);
            stopLocationTracking();
        };
    }, [meeting?.invitation_status, meeting?.is_creator]); // Re-eval when status loads

    const startPolling = () => {
        if (pollRef.current) return;
        pollRef.current = setInterval(fetchMeeting, 10000); // Poll every 10s
    };

    const startTracking = async () => {
        if (isTracking) return;
        setIsTracking(true);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        // Initial check
        checkArrival();

        // Loop check
        trackRef.current = setInterval(checkArrival, 30000); // Check every 30s
    };

    const stopLocationTracking = () => {
        clearInterval(trackRef.current);
        setIsTracking(false);
    };

    const checkArrival = async () => {
        try {
            const loc = await Location.getCurrentPositionAsync({});
            await apiRequest(`/v1/meetings/${id}/check-arrival`, {
                method: 'POST',
                body: JSON.stringify({
                    lat: loc.coords.latitude,
                    lon: loc.coords.longitude
                }),
                requiresAuth: true
            });
        } catch (e) {
            console.log('Tracking error', e);
        }
    };

    async function fetchMeeting() {
        try {
            const data = await apiRequest(`/v1/meetings/${id}`);
            if (data.meeting) {
                setMeeting(data.meeting);
            }
        } catch (error) {
            console.error('Failed to fetch meeting');
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
            fetchMeeting();
        } finally {
            setActionLoading(false);
        }
    };

    const renderOverview = () => (
        <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <ThemedText type="title">{meeting.title}</ThemedText>
                {meeting.is_creator && <View style={[styles.badge, { backgroundColor: theme.tint }]}><ThemedText style={styles.badgeText}>Creator</ThemedText></View>}
            </View>

            {meeting.description && <ThemedText style={styles.description}>{meeting.description}</ThemedText>}

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

            <TouchableOpacity style={[styles.card, { backgroundColor: theme.background, borderColor: theme.icon + '20' }]} onPress={openMapLink}>
                <View style={styles.row}>
                    <IconSymbol size={24} name="location.fill" color={theme.tint} />
                    <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold">{meeting.location.name}</ThemedText>
                        <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>Tap to view on map</ThemedText>
                    </View>
                    <IconSymbol size={20} name="chevron.right" color={theme.icon} />
                </View>
            </TouchableOpacity>

            <View style={styles.actions}>
                {!meeting.is_creator && meeting.invitation_status === 'pending' && (
                    <View style={styles.inviteActions}>
                        <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={() => handleRespond('accepted')} disabled={actionLoading}>
                            <ThemedText style={styles.btnText}>Accept</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={() => handleRespond('declined')} disabled={actionLoading}>
                            <ThemedText style={styles.btnText}>Decline</ThemedText>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </ScrollView>
    );

    const renderLiveMap = () => {
        if (!meeting.is_creator) return <ThemedView style={styles.center}><ThemedText>Only the creator can view user locations.</ThemedText></ThemedView>;

        const lat = Number(meeting.location?.lat);
        const lon = Number(meeting.location?.lon);

        if (!lat || !lon) {
            return <ThemedView style={styles.center}><ThemedText>Invalid Meeting Location</ThemedText></ThemedView>;
        }

        return (
            <View style={{ flex: 1 }}>
                <MapView
                    style={{ flex: 1 }}
                    initialRegion={{
                        latitude: lat,
                        longitude: lon,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                >
                    {/* Meeting Location */}
                    <Marker coordinate={{ latitude: lat, longitude: lon }} title={meeting.title} pinColor="blue" />
                    <Circle center={{ latitude: lat, longitude: lon }} radius={meeting.threshold_km * 1000} fillColor="rgba(0, 150, 255, 0.2)" strokeColor="rgba(0, 150, 255, 0.5)" />

                    {/* Attendees */}
                    {meeting.attendees?.filter((a: any) => a.current_lat && a.current_lon).map((a: any) => (
                        <Marker
                            key={a.user_id}
                            coordinate={{ latitude: a.current_lat, longitude: a.current_lon }}
                            title={a.user?.real_name || a.user?.username}
                            description={`Status: ${a.participation_status}`}
                        />
                    ))}
                </MapView>

                <View style={styles.overlayList}>
                    <ThemedText type="defaultSemiBold" style={{ marginBottom: 10, paddingHorizontal: 10 }}>Participant Status</ThemedText>
                    <FlatList
                        data={meeting.attendees || []}
                        keyExtractor={(item) => item.user_id}
                        renderItem={({ item }) => (
                            <View style={styles.participantRow}>
                                <ThemedText style={{ flex: 1 }}>{item.user?.real_name || item.user?.username}</ThemedText>
                                <ThemedText style={{ color: item.participation_status === 'arrived' ? 'green' : 'gray' }}>
                                    {item.participation_status === 'arrived' && 'Arrived'}
                                    {item.participation_status === 'transit' && 'Nearby'}
                                    {!item.participation_status && item.status}
                                </ThemedText>
                            </View>
                        )}
                    />
                </View>
            </View>
        );
    };

    const renderLogs = () => {
        const logs = meeting.logs || [];
        return (
            <FlatList
                data={logs}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={{ padding: 20 }}
                ListEmptyComponent={<ThemedText style={{ textAlign: 'center', marginTop: 20, opacity: 0.5 }}>No activity logs yet.</ThemedText>}
                renderItem={({ item }) => (
                    <View style={styles.logItem}>
                        <ThemedText style={styles.logTime}>{format(new Date(item.created_at), 'h:mm a')}</ThemedText>
                        <View style={{ flex: 1 }}>
                            <ThemedText>
                                <ThemedText type="defaultSemiBold">{item.users?.real_name || 'User'} </ThemedText>
                                {item.type === 'entered' ? 'arrived at the meeting.' : 'left the meeting.'}
                            </ThemedText>
                            {meeting.is_creator && (
                                <ThemedText style={{ fontSize: 10, opacity: 0.4 }}>
                                    Distance: {(item.distance_km || 0).toFixed(2)}km
                                </ThemedText>
                            )}
                        </View>
                    </View>
                )}
            />
        );
    };

    const openMapLink = () => {
        const { lat, lon, name } = meeting.location;
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${lat},${lon}`;
        const label = name || 'Meeting Location';
        const url = Platform.select({ ios: `${scheme}${label}@${latLng}`, android: `${scheme}${latLng}(${label})` });
        if (url) Linking.openURL(url);
    };

    if (loading) return <ThemedView style={styles.center}><ActivityIndicator size="large" color={theme.tint} /></ThemedView>;
    if (!meeting) return <ThemedView style={styles.center}><ThemedText>Meeting not found</ThemedText></ThemedView>;

    const isCreator = meeting.is_creator;

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ title: 'Meeting Details' }} />

            {(isCreator) && (
                <View style={[styles.tabs, { borderColor: theme.icon + '20' }]}>
                    <TouchableOpacity onPress={() => setActiveTab('overview')} style={[styles.tab, activeTab === 'overview' && { borderBottomColor: theme.tint }]}>
                        <ThemedText style={{ color: activeTab === 'overview' ? theme.tint : theme.icon }}>Overview</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('live')} style={[styles.tab, activeTab === 'live' && { borderBottomColor: theme.tint }]}>
                        <ThemedText style={{ color: activeTab === 'live' ? theme.tint : theme.icon }}>Live Map</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('logs')} style={[styles.tab, activeTab === 'logs' && { borderBottomColor: theme.tint }]}>
                        <ThemedText style={{ color: activeTab === 'logs' ? theme.tint : theme.icon }}>Logs</ThemedText>
                    </TouchableOpacity>
                </View>
            )}

            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'live' && renderLiveMap()}
            {activeTab === 'logs' && renderLogs()}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 20, gap: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    description: { fontSize: 16, opacity: 0.8, lineHeight: 24 },
    card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 16 },
    row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    separator: { height: 1, backgroundColor: 'rgba(150,150,150,0.2)' },
    label: { fontSize: 12, opacity: 0.6, marginBottom: 2 },
    actions: { marginTop: 20, gap: 10 },
    inviteActions: { flexDirection: 'row', gap: 10 },
    btn: { height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', flex: 1 },
    acceptBtn: { backgroundColor: '#4CAF50' },
    declineBtn: { backgroundColor: '#F44336' },
    btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    tabs: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 15, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    overlayList: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'white', borderRadius: 15, padding: 15, maxHeight: 200, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    participantRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
    logItem: { flexDirection: 'row', gap: 15, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
    logTime: { fontSize: 12, opacity: 0.5, width: 60 },
});

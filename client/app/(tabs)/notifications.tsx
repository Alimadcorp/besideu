import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';

type FriendRequest = {
    id: string;
    user_id: string;
    username: string;
    real_name?: string;
    avatar_url?: string;
    created_at: string;
};

type RequestsData = {
    incoming: FriendRequest[];
    outgoing: FriendRequest[];
};

export default function NotificationsScreen() {
    const [requests, setRequests] = useState<RequestsData>({ incoming: [], outgoing: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const fetchRequests = useCallback(async () => {
        try {
            const data = await apiRequest('/v1/friends/requests');
            setRequests(data);
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRequests();
    }, [fetchRequests]);

    const respondToRequest = async (id: string, accept: boolean) => {
        try {
            if (accept) {
                await apiRequest(`/v1/friends/accept?id=${id}`, { method: 'POST' });
                Alert.alert('Accepted', 'Friend request accepted.');
            } else {
                await apiRequest(`/v1/friends/remove?id=${id}`, { method: 'DELETE' });
                Alert.alert('Removed', 'Friend request removed.');
            }
            fetchRequests();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Action failed');
        }
    };

    const renderRequest = ({ item, type }: { item: FriendRequest, type: 'incoming' | 'outgoing' }) => (
        <View style={styles.requestItem}>
            <TouchableOpacity
                style={{ flexDirection: 'row', flex: 1, alignItems: 'center', gap: 15 }}
                onPress={() => router.push(`/user/${item.user_id}` as any)}
            >
                <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                    {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} contentFit="cover" />
                    ) : (
                        <ThemedText style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</ThemedText>
                    )}
                </View>
                <View style={styles.requestInfo}>
                    <ThemedText type="defaultSemiBold">{item.real_name || item.username}</ThemedText>
                    <ThemedText style={styles.subtitle}>@{item.username}</ThemedText>
                </View>
            </TouchableOpacity>
            <View style={styles.requestActions}>
                {type === 'incoming' ? (
                    <>
                        <TouchableOpacity
                            onPress={() => respondToRequest(item.id, true)}
                            style={[styles.actionBtn, { backgroundColor: '#34C759' }]}
                        >
                            <IconSymbol name="checkmark" size={18} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => respondToRequest(item.id, false)}
                            style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]}
                        >
                            <IconSymbol name="xmark" size={18} color="white" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity
                        onPress={() => respondToRequest(item.id, false)}
                        style={[styles.actionBtn, { backgroundColor: theme.icon }]}
                    >
                        <IconSymbol name="xmark" size={18} color="white" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <ThemedView style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <ThemedText type="title">Notifications</ThemedText>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
            >
                {/* Nearby Alerts Placeholder */}
                <View style={[styles.alertCard, { backgroundColor: theme.tint + '10', borderColor: theme.tint + '30' }]}>
                    <IconSymbol name="bell.fill" size={24} color={theme.tint} />
                    <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold">Nearby Alerts</ThemedText>
                        <ThemedText style={styles.cardSubtext}>You'll see alerts here when friends are nearby.</ThemedText>
                    </View>
                </View>

                {/* Friend Requests */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle">Friend Requests</ThemedText>
                        {(requests.incoming.length > 0 || requests.outgoing.length > 0) && (
                            <View style={[styles.countBadge, { backgroundColor: theme.tint }]}>
                                <ThemedText style={styles.countText}>{requests.incoming.length}</ThemedText>
                            </View>
                        )}
                    </View>

                    {requests.incoming.length === 0 && requests.outgoing.length === 0 ? (
                        <View style={styles.emptyRequests}>
                            <IconSymbol name="person.crop.circle.badge.plus" size={40} color={theme.icon} />
                            <ThemedText style={{ opacity: 0.5, marginTop: 10 }}>No pending requests</ThemedText>
                        </View>
                    ) : (
                        <>
                            {requests.incoming.map(req => (
                                <React.Fragment key={req.id}>
                                    {renderRequest({ item: req, type: 'incoming' })}
                                </React.Fragment>
                            ))}
                            {requests.outgoing.length > 0 && (
                                <>
                                    <ThemedText style={styles.subSectionTitle}>Sent Requests</ThemedText>
                                    {requests.outgoing.map(req => (
                                        <React.Fragment key={req.id}>
                                            {renderRequest({ item: req, type: 'outgoing' })}
                                        </React.Fragment>
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </View>

                {/* Activity Feed Placeholder */}
                <View style={styles.section}>
                    <ThemedText type="subtitle">Recent Activity</ThemedText>
                    <ThemedText style={{ opacity: 0.5, marginTop: 10, textAlign: 'center' }}>Keep an eye out for updates from your friends!</ThemedText>
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    scrollContent: {
        padding: 20,
    },
    alertCard: {
        flexDirection: 'row',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: 'center',
        gap: 15,
        marginBottom: 25,
    },
    cardSubtext: {
        fontSize: 12,
        opacity: 0.7,
        marginTop: 2,
    },
    section: {
        marginBottom: 30,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 15,
    },
    countBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    subSectionTitle: {
        marginTop: 20,
        marginBottom: 10,
        fontSize: 14,
        opacity: 0.6,
        fontWeight: '600',
    },
    requestItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 15,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    requestInfo: {
        flex: 1,
    },
    subtitle: {
        fontSize: 12,
        opacity: 0.6,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyRequests: {
        alignItems: 'center',
        padding: 20,
    }
});

import { StyleSheet, View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiRequest } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';

export default function StatusScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();
    const { user } = useAuth();

    const [myStatuses, setMyStatuses] = useState<any[]>([]);
    const [feed, setFeed] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [meData, feedData] = await Promise.all([
                apiRequest('/v1/status/me'),
                apiRequest('/v1/status/feed')
            ]);
            setMyStatuses(meData.statuses || []);
            setFeed(feedData.feed || []);
        } catch (e) {
            console.error('Failed to fetch status data', e);
        }
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateStatus = () => {
        router.push('/status/create' as any);
    };

    // Group feed by user
    const groupedFeed = React.useMemo(() => {
        const groups: Record<string, any[]> = {};
        feed.forEach(s => {
            const userId = s.user_id || s.user?.id;
            if (userId) {
                if (!groups[userId]) groups[userId] = [];
                groups[userId].push(s);
            }
        });
        return Object.values(groups);
    }, [feed]);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <ThemedText type="title">Updates</ThemedText>
                <View style={{ flexDirection: 'row', gap: 15 }}>
                    <TouchableOpacity onPress={handleCreateStatus}>
                        <IconSymbol name="plus.circle.fill" size={28} color={theme.tint} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* My Status */}
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.statusRow}
                    onPress={() => myStatuses.length > 0 ? router.push({ pathname: '/status/view' as any, params: { userId: user?.id } }) : handleCreateStatus()}
                >
                    <View style={styles.avatarContainer}>
                        <Image
                            source={{ uri: user?.avatar_url || 'https://via.placeholder.com/150' }}
                            style={styles.avatar}
                            contentFit="cover"
                        />
                        {myStatuses.length > 0 ? null : (
                            <View style={[styles.plusBadge, { backgroundColor: theme.tint, borderColor: theme.background }]}>
                                <IconSymbol name="plus" size={14} color="white" />
                            </View>
                        )}
                    </View>
                    <View style={styles.statusInfo}>
                        <ThemedText type="defaultSemiBold">My Status</ThemedText>
                        <ThemedText style={{ opacity: 0.6, fontSize: 13 }}>
                            {myStatuses.length > 0
                                ? `${myStatuses.length} updates • Tap to view`
                                : 'Tap to add status update'}
                        </ThemedText>
                    </View>
                </TouchableOpacity>
            </View>

            <ThemedText style={styles.sectionTitle}>Recent Updates</ThemedText>

            {/* Feed */}
            {groupedFeed.length === 0 ? (
                <View style={styles.emptyState}>
                    <ThemedText style={{ opacity: 0.5 }}>No recent updates from friends</ThemedText>
                </View>
            ) : (
                groupedFeed.map((userStatuses: any[]) => {
                    const statusUser = userStatuses[0].user || {};
                    const userId = userStatuses[0].user_id || statusUser.id;
                    const hasUnviewed = userStatuses.some(s => !s.viewed);
                    return (
                        <TouchableOpacity
                            key={userId}
                            style={styles.statusRow}
                            onPress={() => router.push({ pathname: '/status/view' as any, params: { userId } })}
                        >
                            <View style={[
                                styles.ringContainer,
                                hasUnviewed ? { borderColor: theme.tint } : { borderColor: theme.icon + '30' }
                            ]}>
                                <Image
                                    source={{ uri: statusUser.avatar_url || 'https://via.placeholder.com/150' }}
                                    style={styles.feedAvatar}
                                    contentFit="cover"
                                />
                            </View>
                            <View style={styles.statusInfo}>
                                <ThemedText type="defaultSemiBold">{statusUser.real_name || statusUser.username || 'Unknown'}</ThemedText>
                                <ThemedText style={{ opacity: 0.6, fontSize: 13 }}>
                                    {new Date(userStatuses[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    • {userStatuses.length} updates
                                </ThemedText>
                            </View>
                        </TouchableOpacity>
                    );
                })
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    section: {
        marginBottom: 20,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 15,
    },
    avatarContainer: {
        position: 'relative',
        width: 58,
        height: 58,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
    },
    plusBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    statusInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    sectionTitle: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        fontSize: 14,
        fontWeight: 'bold',
        opacity: 0.5,
    },
    ringContainer: {
        width: 62,
        height: 62,
        borderRadius: 31,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
    },
    feedAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    }
});

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Link, Stack } from 'expo-router';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Friend = {
    id: string; // friendship_id / dm_id
    friend_id: string;
    username: string;
    real_name?: string;
    avatar_url?: string;
    last_message?: string;
    unread_count: number;
};

export default function FriendsScreen() {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    const fetchFriends = useCallback(async () => {
        try {
            const data = await apiRequest('/v1/friends/list');
            setFriends(data.friends || []);
        } catch (error) {
            console.error('Failed to fetch friends:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchFriends();
    }, [fetchFriends]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchFriends();
    }, [fetchFriends]);

    const removeFriend = async (friendshipId: string, username: string) => {
        Alert.alert(
            'Remove Friend',
            `Are you sure you want to remove ${username} from your friends?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiRequest(`/v1/friends/remove?id=${friendshipId}`, { method: 'DELETE' });
                            fetchFriends();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to remove friend');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: Friend }) => (
        <TouchableOpacity
            style={styles.item}
            onPress={() => {
                router.push(`/chats/${item.id}` as any);
            }}
        >
            <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => router.push(`/user/${item.friend_id}` as any)}
            >
                <View style={[styles.avatar, { backgroundColor: theme.tint, overflow: 'hidden' }]}>
                    {item.avatar_url ? (
                        <Image
                            source={{ uri: item.avatar_url }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                        />
                    ) : (
                        <ThemedText style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</ThemedText>
                    )}
                </View>
                {item.unread_count > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#FF3B30', position: 'absolute', right: -4, top: -4 }]}>
                        <ThemedText style={styles.badgeText}>{item.unread_count}</ThemedText>
                    </View>
                )}
            </TouchableOpacity>
            <View style={styles.userInfo}>
                <ThemedText numberOfLines={1} type="defaultSemiBold" style={styles.username}>
                    {item.real_name || item.username}
                </ThemedText>
                <ThemedText style={styles.handle}>@{item.username}</ThemedText>
                {item.last_message && (
                    <ThemedText numberOfLines={1} style={styles.lastMsg}>{item.last_message}</ThemedText>
                )}
            </View>
            <View style={styles.actions}>
                <TouchableOpacity onPress={() => removeFriend(item.id, item.username)} style={styles.iconBtn}>
                    <IconSymbol name="person.badge.minus" size={20} color={theme.icon} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {loading ? (
                <View style={[styles.center, { paddingTop: 100 }]}>
                    <ActivityIndicator size="large" color={theme.tint} />
                </View>
            ) : (
                <FlatList
                    data={friends}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
                    ListHeaderComponent={
                        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                            <View>
                                <ThemedText type="title">Friends</ThemedText>
                                <ThemedText style={styles.subtitle}>{friends.length} connections</ThemedText>
                            </View>
                            <Link href="/contacts" asChild>
                                <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.tint }]}>
                                    <IconSymbol name="plus" size={16} color="white" />
                                    <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Find Friends</ThemedText>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyIcon, { backgroundColor: theme.tint + '15' }]}>
                                <IconSymbol name="person.2.fill" size={48} color={theme.tint} />
                            </View>
                            <ThemedText style={styles.emptyTitle}>Your circle is quiet</ThemedText>
                            <ThemedText style={styles.emptySubtext}>Connect with people you know or find someone nearby to start a conversation.</ThemedText>
                            <Link href="/contacts" asChild>
                                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.tint }]}>
                                    <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Sync Contacts</ThemedText>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    }
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 25,
    },
    subtitle: {
        fontSize: 14,
        opacity: 0.5,
        marginTop: 2,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
        gap: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    item: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    avatarContainer: {
        marginRight: 16,
        position: 'relative',
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    avatarText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 17,
        fontWeight: '700',
    },
    handle: {
        fontSize: 13,
        opacity: 0.4,
        marginTop: 1,
    },
    lastMsg: {
        fontSize: 13,
        opacity: 0.6,
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'white',
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 1,
        paddingTop: 80,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 10,
    },
    emptySubtext: {
        textAlign: 'center',
        opacity: 0.5,
        marginBottom: 32,
        lineHeight: 22,
        fontSize: 15,
    },
    primaryButton: {
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    }
});

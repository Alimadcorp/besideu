import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter, Link } from 'expo-router';

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
    created_at: string;
};

type RequestsData = {
    incoming: FriendRequest[];
    outgoing: FriendRequest[];
};

export default function FriendRequestsScreen() {
    const [requests, setRequests] = useState<RequestsData>({ incoming: [], outgoing: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

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

    const renderItem = ({ item, type }: { item: FriendRequest, type: 'incoming' | 'outgoing' }) => (
        <View style={[styles.item, { borderBottomColor: theme.icon }]}>
            <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                    <ThemedText style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</ThemedText>
                </View>
            </View>
            <View style={styles.userInfo}>
                <ThemedText type="defaultSemiBold" style={styles.username}>{item.username}</ThemedText>
                <ThemedText style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</ThemedText>
            </View>
            <View style={styles.actions}>
                {type === 'incoming' ? (
                    <>
                        <TouchableOpacity onPress={() => respondToRequest(item.id, true)} style={[styles.actionBtn, { backgroundColor: '#34C759', marginRight: 10 }]}>
                            <IconSymbol name="checkmark" size={18} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => respondToRequest(item.id, false)} style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]}>
                            <IconSymbol name="xmark" size={18} color="white" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity onPress={() => respondToRequest(item.id, false)} style={[styles.actionBtn, { backgroundColor: '#8E8E93' }]}>
                        <IconSymbol name="xmark" size={18} color="white" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <ThemedView style={styles.container}>
            {loading ? (
                <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 20 }} />
            ) : (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh}>
                    <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle">Incoming ({requests.incoming.length})</ThemedText>
                    </View>
                    {requests.incoming.length === 0 && <ThemedText style={styles.emptyText}>No incoming requests</ThemedText>}
                    <FlatList
                        data={requests.incoming}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => renderItem({ item, type: 'incoming' })}
                        scrollEnabled={false}
                    />

                    <View style={styles.sectionHeader}>
                        <ThemedText type="subtitle">Outgoing ({requests.outgoing.length})</ThemedText>
                    </View>
                    {requests.outgoing.length === 0 && <ThemedText style={styles.emptyText}>No outgoing requests</ThemedText>}
                    <FlatList
                        data={requests.outgoing}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => renderItem({ item, type: 'outgoing' })}
                        scrollEnabled={false}
                    />
                </RefreshControl>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 15,
    },
    sectionHeader: {
        marginTop: 20,
        marginBottom: 10,
    },
    item: {
        flexDirection: 'row',
        padding: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
    },
    avatarContainer: {
        marginRight: 15,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 16,
    },
    date: {
        fontSize: 12,
        opacity: 0.6,
    },
    actions: {
        flexDirection: 'row',
    },
    actionBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        opacity: 0.5,
        marginLeft: 15,
        marginBottom: 10
    }
});

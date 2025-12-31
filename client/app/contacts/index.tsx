import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Platform, TextInput, Share } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hashPhone } from '@/utils/crypto';

type ContactUser = {
    user_id?: string;
    username?: string;
    phone: string;
    contact_name: string;
    avatar_url?: string;
    is_friend?: boolean;
    request_id?: string | null;
    request_direction?: 'incoming' | 'outgoing' | null;
    isOnApp: boolean;
};

export default function ContactsScreen() {
    const [contacts, setContacts] = useState<ContactUser[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<ContactUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 40;

    const [processingId, setProcessingId] = useState<string | null>(null);

    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const fetchContactsList = useCallback(async () => {
        try {
            const serverData = await apiRequest('/v1/contacts/list');
            const matches = serverData.matched || [];
            const matchMap = new Map();
            matches.forEach((m: any) => matchMap.set(m.hash, m));

            const { status } = await Contacts.getPermissionsAsync();
            let allDeviceContacts: ContactUser[] = [];

            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
                });

                // Group by contact name (not phone)
                const contactsByName = new Map<string, ContactUser[]>();

                data.forEach(c => {
                    const contactName = (c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()).trim();
                    if (!contactName) return;

                    if (c.phoneNumbers && c.phoneNumbers.length > 0) {
                        const phones: ContactUser[] = [];
                        let hasOnApp = false;
                        let hasFriend = false;
                        let bestMatch: any = null;

                        c.phoneNumbers.forEach(p => {
                            const normalized = p.number || '';
                            const h = hashPhone(normalized);
                            if (h) {
                                const match = matchMap.get(h);
                                if (match) {
                                    hasOnApp = true;
                                    if (match.is_friend) hasFriend = true;
                                    // Keep the best match (prefer friend)
                                    if (!bestMatch || (match.is_friend && !bestMatch.is_friend)) {
                                        bestMatch = match;
                                    }
                                }
                            }
                        });

                        // Create one contact entry per name (show all contacts, not just on-app)
                        contactsByName.set(contactName, [{
                            user_id: bestMatch?.user_id,
                            username: bestMatch?.username,
                            avatar_url: bestMatch?.avatar_url,
                            contact_name: contactName,
                            is_friend: hasFriend,
                            phone: c.phoneNumbers[0].number || '',
                            request_id: bestMatch?.request_id,
                            request_direction: bestMatch?.request_direction,
                            isOnApp: hasOnApp
                        }]);
                    }
                });

                // Convert map to array (already deduplicated by name)
                const unique = Array.from(contactsByName.values()).flat();

                // Sort: Friends first, then On App users, then alphabetical
                unique.sort((a, b) => {
                    // Priority 1: Friends
                    if (a.is_friend !== b.is_friend) return a.is_friend ? -1 : 1;
                    // Priority 2: Anyone on the app
                    if (a.isOnApp !== b.isOnApp) return a.isOnApp ? -1 : 1;
                    // Final: Alphabetical
                    return a.contact_name.localeCompare(b.contact_name);
                });

                setContacts(unique);
                setFilteredContacts(unique.slice(0, PAGE_SIZE));
                setPage(1);
            }
        } catch (error) {
            console.error('Failed to fetch/map contacts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const syncContacts = async () => {
        setSyncing(true);
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers],
                });

                const allHashes: string[] = [];
                data.forEach(c => {
                    c.phoneNumbers?.forEach(p => {
                        const h = hashPhone(p.number || '');
                        if (h) allHashes.push(h);
                    });
                });

                await apiRequest('/v1/contacts/set', {
                    method: 'PUT',
                    body: JSON.stringify({
                        hashes: allHashes,
                        timestamp: new Date().toISOString()
                    })
                });

                Alert.alert('Synced', 'Your contacts have been updated.');
                fetchContactsList();
            } else {
                Alert.alert('Permission Denied', 'BesideU needs contacts permission to find your friends.');
            }
        } catch (error: any) {
            Alert.alert('Sync Failed', error.message || 'Please try again later.');
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchContactsList();
    }, [fetchContactsList]);

    useEffect(() => {
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = contacts.filter(c =>
            c.contact_name.toLowerCase().includes(lowerQuery) ||
            (c.username && c.username.toLowerCase().includes(lowerQuery))
        );
        setFilteredContacts(filtered.slice(0, PAGE_SIZE));
        setPage(1);
    }, [searchQuery, contacts]);

    const loadMore = () => {
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = contacts.filter(c =>
            c.contact_name.toLowerCase().includes(lowerQuery) ||
            (c.username && c.username.toLowerCase().includes(lowerQuery))
        );

        if (filteredContacts.length < filtered.length) {
            const nextPage = page + 1;
            setFilteredContacts(filtered.slice(0, nextPage * PAGE_SIZE));
            setPage(nextPage);
        }
    };

    const shareApp = async (contactName: string) => {
        try {
            await Share.share({
                message: `Hi ${contactName}, join me on BesideU! Download it here: https://play.google.com/store/apps/details?id=co.alimad.besideu`,
            });
        } catch (error) {
            console.log('Error sharing', error);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchContactsList();
    }, [fetchContactsList]);

    const addFriend = async (userId: string) => {
        setProcessingId(userId);
        try {
            await apiRequest(`/v1/friends/add?user=${userId}&isContact=true`, { method: 'POST' });
            Alert.alert('Sent', 'Friend request has been sent!');
            fetchContactsList();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const respondToRequest = async (id: string, userId: string, accept: boolean) => {
        setProcessingId(userId);
        try {
            if (accept) {
                await apiRequest(`/v1/friends/accept?id=${id}`, { method: 'POST' });
                Alert.alert('Accepted', 'Friend request accepted.');
            } else {
                await apiRequest(`/v1/friends/remove?id=${id}`, { method: 'DELETE' });
                Alert.alert('Removed', 'Friend request removed.');
            }
            fetchContactsList();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Action failed');
        } finally {
            setProcessingId(null);
        }
    };

    const renderItem = ({ item }: { item: ContactUser }) => (
        <View style={styles.item}>
            <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: item.isOnApp ? theme.tint : theme.icon + '40', overflow: 'hidden' }]}>
                    {item.avatar_url ? (
                        <Image
                            source={{ uri: item.avatar_url }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                        />
                    ) : (
                        <ThemedText style={styles.avatarText}>{item.contact_name.charAt(0).toUpperCase()}</ThemedText>
                    )}
                </View>
            </View>
            <View style={styles.userInfo}>
                <ThemedText type="defaultSemiBold" style={styles.username}>{item.contact_name}</ThemedText>
                {item.username && <ThemedText style={styles.handle}>@{item.username}</ThemedText>}
            </View>
            <View style={styles.actions}>
                {item.isOnApp ? (
                    processingId === item.user_id ? (
                        <ActivityIndicator color={theme.tint} size="small" style={{ marginRight: 10 }} />
                    ) : item.is_friend ? (
                        <View style={styles.addedBadge}>
                            <IconSymbol name="checkmark.circle.fill" size={16} color={theme.tint} />
                            <ThemedText style={[styles.addedText, { color: theme.tint }]}>Friend</ThemedText>
                        </View>
                    ) : item.request_id ? (
                        item.request_direction === 'incoming' ? (
                            <TouchableOpacity
                                onPress={() => respondToRequest(item.request_id!, item.user_id!, true)}
                                style={[styles.syncBtn, { backgroundColor: theme.tint, paddingVertical: 6, paddingHorizontal: 12, minWidth: 0 }]}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>Accept</ThemedText>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.addedBadge}>
                                <ThemedText style={{ opacity: 0.5, fontSize: 12 }}>Pending</ThemedText>
                            </View>
                        )
                    ) : (
                        <TouchableOpacity
                            onPress={() => addFriend(item.user_id!)}
                            style={[styles.actionBtn, { backgroundColor: theme.tint }]}
                        >
                            <IconSymbol name="plus" size={18} color="white" />
                        </TouchableOpacity>
                    )
                ) : (
                    <TouchableOpacity
                        onPress={() => shareApp(item.contact_name)}
                        style={[styles.inviteBtn, { borderColor: theme.tint }]}
                    >
                        <ThemedText style={[styles.inviteText, { color: theme.tint }]}>Invite</ThemedText>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <FlatList
                data={filteredContacts}
                keyExtractor={(item, index) => `${item.phone}-${index}`}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <View style={styles.headerTop}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                                <IconSymbol name="chevron.left" size={24} color={theme.text} />
                            </TouchableOpacity>
                            <ThemedText type="title" style={{ flex: 1, marginLeft: 10 }}>Add Friends</ThemedText>
                        </View>

                        <View style={[styles.searchContainer, { backgroundColor: theme.icon + '15' }]}>
                            <IconSymbol name="magnifyingglass" size={18} color={theme.icon} />
                            <TextInput
                                style={[styles.searchInput, { color: theme.text }]}
                                placeholder="Search contacts..."
                                placeholderTextColor={theme.icon}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        {!searchQuery && (
                            <View style={[styles.syncCard, { backgroundColor: theme.tint + '10', borderColor: theme.tint + '30' }]}>
                                <View style={{ flex: 1 }}>
                                    <ThemedText type="defaultSemiBold">Sync Contacts</ThemedText>
                                    <ThemedText style={styles.syncSubtext}>Keep your friend list up to date.</ThemedText>
                                </View>
                                <TouchableOpacity
                                    onPress={syncContacts}
                                    disabled={syncing}
                                    style={[styles.syncBtn, { backgroundColor: theme.tint }]}
                                >
                                    {syncing ? <ActivityIndicator color="white" size="small" /> : <ThemedText style={styles.syncBtnText}>Sync</ThemedText>}
                                </TouchableOpacity>
                            </View>
                        )}

                        {filteredContacts.length > 0 && (
                            <ThemedText type="subtitle" style={styles.matchesTitle}>
                                {searchQuery ? `Search results (${filteredContacts.length})` : 'All Contacts'}
                            </ThemedText>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={[styles.emptyIcon, { backgroundColor: theme.icon + '10' }]}>
                            <IconSymbol name="person.crop.circle.badge.questionmark" size={40} color={theme.icon} />
                        </View>
                        <ThemedText style={styles.emptyTitle}>No Contacts Found</ThemedText>
                        <ThemedText style={styles.emptySubtext}>We couldn't find any contacts matching your search.</ThemedText>
                    </View>
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 40,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backBtn: {
        padding: 5,
        marginLeft: -10,
    },
    syncCard: {
        flexDirection: 'row',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        gap: 15,
        marginBottom: 30,
    },
    syncSubtext: {
        fontSize: 12,
        opacity: 0.7,
        marginTop: 4,
        lineHeight: 16,
    },
    syncBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        minWidth: 90,
        alignItems: 'center',
    },
    syncBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13,
    },
    matchesTitle: {
        fontSize: 16,
        marginBottom: 10,
    },
    item: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        alignItems: 'center',
    },
    avatarContainer: {
        marginRight: 15,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 16,
    },
    handle: {
        fontSize: 13,
        opacity: 0.5,
        marginTop: 2,
    },
    actions: {
        alignItems: 'flex-end',
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    addedText: {
        fontSize: 13,
        fontWeight: '600',
    },
    emptyContainer: {
        paddingTop: 60,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptySubtext: {
        textAlign: 'center',
        opacity: 0.6,
        marginBottom: 30,
        lineHeight: 20,
    },
    primaryButton: {
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 46,
        borderRadius: 23,
        marginBottom: 25,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        padding: 0,
    },
    inviteBtn: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 15,
        borderWidth: 1.5,
    },
    inviteText: {
        fontSize: 13,
        fontWeight: 'bold',
    }
});

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as Contacts from 'expo-contacts';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hashPhone } from '@/utils/crypto';

type ContactUser = {
    user_id: string;
    username: string;
    phone: string;
    contact_name: string;
    is_friend: boolean;
};

export default function ContactsScreen() {
    const [contacts, setContacts] = useState<ContactUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const fetchContactsList = useCallback(async () => {
        try {
            // 1. Fetch matches from server (Hashes, UserIDs, Usernames)
            const serverData = await apiRequest('/v1/contacts/list');
            const matches = serverData.matched || [];

            // 2. Read local contacts to resolve "Real Name" from Hash
            let hashToName = new Map<string, string>();

            // Check permission first without requesting (don't annoy user on load if they denied before)
            // Or just try-catch request?
            const { status } = await Contacts.getPermissionsAsync();

            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
                });

                data.forEach(c => {
                    if (c.phoneNumbers) {
                        c.phoneNumbers.forEach(p => {
                            const h = hashPhone(p.number || '');
                            if (h && c.name) {
                                hashToName.set(h, c.name);
                            }
                        });
                    }
                });
            }

            // 3. Merge
            const merged = matches.map((m: any) => ({
                user_id: m.user_id,
                username: m.username,
                // Resolve name locally using the returned hash
                contact_name: hashToName.get(m.hash) || m.username,
                is_friend: m.is_friend,
                phone: m.hash
            }));

            setContacts(merged);
        } catch (error) {
            console.error('Failed to fetch/map contacts:', error);
        } finally {
            setLoading(false);
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
                if (data.length > 0) {
                    data.forEach(c => {
                        c.phoneNumbers?.forEach(p => {
                            const h = hashPhone(p.number || '');
                            if (h) allHashes.push(h);
                        });
                    });
                }

                // Send ONLY hashes to server
                await apiRequest('/v1/contacts/set', {
                    method: 'PUT',
                    body: JSON.stringify({
                        hashes: allHashes,
                        timestamp: new Date().toISOString()
                    })
                });

                Alert.alert('Success', 'Contacts synced!');
                fetchContactsList(); // Refresh list to update names/matches
            } else {
                Alert.alert('Permission missing', 'Contacts permission is required to sync.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchContactsList();
    }, [fetchContactsList]);

    const addFriend = async (userId: string) => {
        try {
            await apiRequest(`/v1/friends/add?user=${userId}&isContact=true`, { method: 'POST' });
            Alert.alert('Success', 'Friend request sent!');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const renderItem = ({ item }: { item: ContactUser }) => (
        <View style={[styles.item, { borderBottomColor: theme.icon }]}>
            <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                    <ThemedText style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</ThemedText>
                </View>
            </View>
            <View style={styles.userInfo}>
                <ThemedText type="defaultSemiBold" style={styles.username}>{item.contact_name}</ThemedText>
                <ThemedText style={styles.phone}>{item.username}</ThemedText>
            </View>
            <View style={styles.actions}>
                {!item.is_friend && (
                    <TouchableOpacity onPress={() => addFriend(item.user_id)} style={[styles.actionBtn, { backgroundColor: theme.tint }]}>
                        <IconSymbol name="plus" size={18} color="white" />
                    </TouchableOpacity>
                )}
                {item.is_friend && (
                    <ThemedText style={{ opacity: 0.5, fontSize: 12 }}>Added</ThemedText>
                )}
            </View>
        </View>
    );

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ title: 'Contacts' }} />
            <View style={styles.header}>
                <ThemedText>Sync your contacts to find friends.</ThemedText>
                <TouchableOpacity
                    onPress={syncContacts}
                    disabled={syncing}
                    style={[styles.syncBtn, { backgroundColor: theme.tint, opacity: syncing ? 0.7 : 1 }]}
                >
                    {syncing ? <ActivityIndicator color="white" /> : <ThemedText style={{ color: 'white' }}>Sync Now</ThemedText>}
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={contacts}
                    keyExtractor={item => item.user_id}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <ThemedText>No contacts on BesideU yet.</ThemedText>
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
    header: {
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: '#ccc'
    },
    syncBtn: {
        padding: 10,
        borderRadius: 8,
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
    phone: {
        fontSize: 12,
        opacity: 0.6
    },
    actions: {
        justifyContent: 'center'
    },
    actionBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
    }
});

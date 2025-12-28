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
            const data = await apiRequest('/v1/contacts/list');
            setContacts(data.matched);
        } catch (error) {
            console.error('Failed to fetch contacts list:', error);
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
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
                });

                if (data.length > 0) {
                    // Format contacts for API - Hashing for privacy!
                    const formattedContacts = data.map(c => ({
                        name: c.name || 'Unknown',
                        phone: c.phoneNumbers?.map(p => hashPhone(p.number || '')).filter(Boolean) || []
                    })).filter(c => c.phone.length > 0);

                    await apiRequest('/v1/contacts/set', {
                        method: 'PUT',
                        body: JSON.stringify({
                            contacts: formattedContacts,
                            length: formattedContacts.length,
                            timestamp: new Date().toISOString()
                        })
                    });

                    Alert.alert('Success', 'Contacts synced!');
                    fetchContactsList(); // Refresh list
                } else {
                    Alert.alert('Info', 'No contacts found on device.');
                }
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

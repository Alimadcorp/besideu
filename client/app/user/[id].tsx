import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchUserProfile = useCallback(async () => {
        try {
            const data = await apiRequest(`/v1/user/${id}/profile`);
            setProfile(data.profile);
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            Alert.alert('Error', 'Could not load user profile.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    const handleMessage = () => {
        // Find the DM ID if it exists, or just push to chats/[id]
        // Our backend usually maps friendship_id/dm_id. 
        // If we don't have it, we might need to create it.
        // For now, if we are on this screen, we might already have it or we can redirect to a search logic.
        router.push(`/chats/${id}` as any);
    };

    const handleAddFriend = async () => {
        try {
            await apiRequest(`/v1/friends/add?user=${id}`, { method: 'POST' });
            Alert.alert('Success', 'Friend request sent!');
            fetchUserProfile();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send request');
        }
    };

    if (loading) {
        return (
            <ThemedView style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.tint} />
            </ThemedView>
        );
    }

    if (!profile) {
        return (
            <ThemedView style={[styles.container, styles.center]}>
                <ThemedText>User not found</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ title: profile.username, headerTransparent: true, headerTitle: '' }} />

            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
                {/* Hero Header */}
                <View style={[styles.hero, { backgroundColor: theme.tint + '10' }]}>
                    <View style={[styles.avatarContainer, { borderColor: theme.background }]}>
                        {profile.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }]}>
                                <ThemedText style={styles.avatarText}>{profile.username.charAt(0).toUpperCase()}</ThemedText>
                            </View>
                        )}
                        {profile.is_online && <View style={styles.onlineIndicator} />}
                    </View>

                    <ThemedText type="title" style={styles.name}>{profile.real_name || profile.username}</ThemedText>
                    <ThemedText style={styles.handle}>@{profile.username}</ThemedText>

                    {profile.status && (
                        <View style={[styles.statusBadge, { backgroundColor: theme.tint + '20' }]}>
                            <ThemedText style={[styles.statusText, { color: theme.tint }]}>{profile.status}</ThemedText>
                        </View>
                    )}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity style={[styles.primaryAction, { backgroundColor: theme.tint }]} onPress={handleMessage}>
                        <IconSymbol name="message.fill" size={20} color="white" />
                        <ThemedText style={styles.actionText}>Message</ThemedText>
                    </TouchableOpacity>

                    {!profile.is_friend && (
                        <TouchableOpacity style={[styles.secondaryAction, { borderColor: theme.tint }]} onPress={handleAddFriend}>
                            <IconSymbol name="person.badge.plus.fill" size={20} color={theme.tint} />
                            <ThemedText style={[styles.actionText, { color: theme.tint }]}>Add Friend</ThemedText>
                        </TouchableOpacity>
                    )}
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>About</ThemedText>
                    {profile.bio ? (
                        <ThemedText style={styles.bio}>{profile.bio}</ThemedText>
                    ) : (
                        <ThemedText style={styles.emptyText}>No bio yet.</ThemedText>
                    )}

                    {profile.website && (
                        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(profile.website)}>
                            <IconSymbol name="link" size={18} color={theme.icon} />
                            <ThemedText style={[styles.infoText, { color: theme.tint }]}>{profile.website}</ThemedText>
                        </TouchableOpacity>
                    )}

                    {(profile.phone || profile.public_phone) && (
                        <View style={styles.infoRow}>
                            <IconSymbol name="phone.fill" size={18} color={theme.icon} />
                            <ThemedText style={styles.infoText}>{profile.phone || profile.public_phone}</ThemedText>
                            {profile.phone && <View style={styles.secureBadge}><ThemedText style={styles.secureText}>SECURE</ThemedText></View>}
                        </View>
                    )}
                </View>

                {/* Business Section */}
                {profile.is_business && (
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Business Info</ThemedText>
                        <View style={styles.infoRow}>
                            <IconSymbol name="tag.fill" size={18} color={theme.icon} />
                            <ThemedText style={styles.infoText}>{profile.business_type || 'Professional'}</ThemedText>
                        </View>
                        <View style={{ marginTop: 10 }}>
                            <ThemedText style={styles.emptyText}>This is a verified business account.</ThemedText>
                        </View>
                    </View>
                )}

                {/* Last Online */}
                <View style={styles.footer}>
                    <ThemedText style={styles.lastOnline}>
                        {profile.is_online ? 'Active now' : profile.last_online ? `Last seen ${new Date(profile.last_online).toLocaleString()}` : 'Last seen unknown'}
                    </ThemedText>
                </View>
            </ScrollView>
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
    hero: {
        alignItems: 'center',
        paddingTop: 100,
        paddingBottom: 30,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        position: 'relative',
        marginBottom: 15,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
    },
    avatarText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: 'white',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 25,
        height: 25,
        borderRadius: 12.5,
        backgroundColor: '#34C759',
        borderWidth: 4,
        borderColor: 'white',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    handle: {
        fontSize: 16,
        opacity: 0.6,
        marginTop: 2,
    },
    statusBadge: {
        marginTop: 15,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginVertical: 20,
    },
    primaryAction: {
        flex: 1,
        flexDirection: 'row',
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    secondaryAction: {
        flex: 1,
        flexDirection: 'row',
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
    },
    actionText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: 12,
        opacity: 0.8,
    },
    bio: {
        fontSize: 16,
        lineHeight: 24,
        opacity: 0.8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 15,
    },
    infoText: {
        fontSize: 16,
    },
    emptyText: {
        opacity: 0.4,
        fontStyle: 'italic',
    },
    secureBadge: {
        backgroundColor: '#34C75920',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    secureText: {
        fontSize: 10,
        color: '#34C759',
        fontWeight: 'bold',
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
    },
    lastOnline: {
        fontSize: 12,
        opacity: 0.4,
    }
});

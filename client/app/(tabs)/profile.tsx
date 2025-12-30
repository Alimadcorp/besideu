import { StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, View, ActivityIndicator } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiRequest } from '@/utils/api';

export default function ProfileScreen() {
    const { user: authUser, signOut } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [range, setRange] = useState(5);

    React.useEffect(() => {
        fetchProfile();
    }, []);

    async function fetchProfile() {
        try {
            const data = await apiRequest('/v1/user/me');
            setProfile(data.user);
            const prefs = data.user.preferences || {};
            setLocationEnabled(prefs.share_location !== false);
            setRange(prefs.range || 5);
        } catch (error) {
            console.error('Failed to fetch profile', error);
        } finally {
            setLoading(false);
        }
    }

    async function updateProfile(updates: any) {
        setSaving(true);
        try {
            const data = await apiRequest('/v1/user/settings', {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            if (data.success) {
                setProfile((prev: any) => ({ ...prev, ...data.user }));
            }
        } catch (error) {
            console.error('Failed to update profile', error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    }

    const toggleLocation = (value: boolean) => {
        setLocationEnabled(value);
        updateProfile({ preferences: { range, share_location: value } });
    };

    const updateRange = (newRange: number) => {
        setRange(newRange);
        updateProfile({ preferences: { range: newRange, share_location: locationEnabled } });
    }

    const handleLogout = async () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log Out', style: 'destructive', onPress: signOut },
            ]
        );
    };

    const openWebsite = () => {
        WebBrowser.openBrowserAsync('https://besideu.alimad.co');
    };

    const navigateContacts = () => {
        router.push('/contacts' as any);
    }

    const navigateFriends = () => {
        router.push('/friends' as any);
    }

    if (loading) {
        return (
            <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.tint} />
            </ThemedView>
        );
    }

    const user = profile || authUser;

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                        <ThemedText style={styles.avatarText}>
                            {(user?.username?.charAt(0).toUpperCase() + user?.username?.charAt(1).toLowerCase()) || 'U'}
                        </ThemedText>
                    </View>
                    <ThemedText type="title" style={styles.username}>
                        {user?.real_name || 'User'}
                    </ThemedText>
                    <ThemedText style={styles.handle}>@{user?.username}</ThemedText>
                    {saving && <ThemedText style={{ fontSize: 12, color: theme.tint, marginTop: 5 }}>Saving...</ThemedText>}
                </View>

                {/* Account Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Account</ThemedText>

                    <TouchableOpacity
                        style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                        onPress={() => {
                            Alert.prompt(
                                'Change Name',
                                'Enter your full name',
                                (name) => {
                                    if (name) updateProfile({ real_name: name });
                                },
                                'plain-text',
                                user?.real_name
                            );
                        }}
                    >
                        <View>
                            <ThemedText style={styles.rowLabel}>Full Name</ThemedText>
                            <ThemedText style={styles.rowSubtext}>{user?.real_name}</ThemedText>
                        </View>
                        <IconSymbol name="pencil" size={16} color={theme.icon} />
                    </TouchableOpacity>

                    <View style={[styles.row, { borderBottomColor: theme.icon + '20' }]}>
                        <View>
                            <ThemedText style={styles.rowLabel}>Username</ThemedText>
                            <ThemedText style={styles.rowSubtext}>@{user?.username}</ThemedText>
                        </View>
                        <ThemedText style={[styles.rowValue, { fontSize: 12 }]}>Locked</ThemedText>
                    </View>

                    <View style={[styles.row, { borderBottomColor: theme.icon + '20' }]}>
                        <View>
                            <ThemedText style={styles.rowLabel}>Phone Number</ThemedText>
                            <ThemedText style={styles.rowSubtext}>{user?.phone}</ThemedText>
                        </View>
                        <IconSymbol name="phone" size={16} color={theme.icon} />
                    </View>

                    <TouchableOpacity
                        style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                        onPress={() => {
                            Alert.prompt(
                                'Change Email',
                                'Enter your email address',
                                (email) => {
                                    if (email) updateProfile({ email });
                                },
                                'plain-text',
                                user?.email
                            );
                        }}
                    >
                        <View>
                            <ThemedText style={styles.rowLabel}>Email</ThemedText>
                            <ThemedText style={styles.rowSubtext}>{user?.email || 'Not set'}</ThemedText>
                        </View>
                        <IconSymbol name="envelope" size={16} color={theme.icon} />
                    </TouchableOpacity>
                </View>

                {/* Settings Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Preferences</ThemedText>

                    <View style={[styles.row, { borderBottomColor: theme.icon + '20' }]}>
                        <ThemedText style={styles.rowLabel}>Share Location</ThemedText>
                        <Switch
                            value={locationEnabled}
                            onValueChange={toggleLocation}
                            trackColor={{ false: '#767577', true: theme.tint }}
                            disabled={saving}
                        />
                    </View>

                    <View style={[styles.row, { borderBottomColor: theme.icon + '20' }]}>
                        <View>
                            <ThemedText style={styles.rowLabel}>Discovery Radius</ThemedText>
                            <ThemedText style={styles.rowSubtext}>{range} km</ThemedText>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={() => updateRange(Math.max(1, range - 1))}
                                disabled={saving}
                                style={[styles.rangeBtn, { backgroundColor: theme.icon + '20' }]}
                            >
                                <ThemedText style={styles.rangeBtnText}>-</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => updateRange(Math.min(50, range + 1))}
                                disabled={saving}
                                style={[styles.rangeBtn, { backgroundColor: theme.icon + '20' }]}
                            >
                                <ThemedText style={styles.rangeBtnText}>+</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Social Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Social</ThemedText>

                    <TouchableOpacity style={[styles.row, { borderBottomColor: theme.icon }]} onPress={navigateFriends}>
                        <ThemedText style={styles.rowLabel}>Manage Friends</ThemedText>
                        <IconSymbol name="chevron.right" size={20} color={theme.icon} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.row, { borderBottomColor: theme.icon }]} onPress={navigateContacts}>
                        <ThemedText style={styles.rowLabel}>Invite from Contacts</ThemedText>
                        <IconSymbol name="chevron.right" size={20} color={theme.icon} />
                    </TouchableOpacity>
                </View>

                {/* Info Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>About</ThemedText>

                    <TouchableOpacity style={[styles.row, { borderBottomColor: theme.icon }]} onPress={openWebsite}>
                        <ThemedText style={styles.rowLabel}>Website</ThemedText>
                        <IconSymbol name="chevron.right" size={20} color={theme.icon} />
                    </TouchableOpacity>

                    <View style={[styles.row, { borderBottomColor: theme.icon }]}>
                        <ThemedText style={styles.rowLabel}>Version</ThemedText>
                        <ThemedText style={styles.rowValue}>1.0.0 (Beta)</ThemedText>
                    </View>

                    <View style={[styles.row, { borderBottomColor: theme.icon }]}>
                        <ThemedText style={styles.rowLabel}>Made by</ThemedText>
                        <ThemedText style={styles.rowValue}>Muhammad Ali</ThemedText>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={[styles.logoutButton, { borderColor: 'red' }]} onPress={handleLogout}>
                    <ThemedText style={{ color: 'red', fontWeight: 'bold' }}>Log Out</ThemedText>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <ThemedText style={styles.footerText}>&quot;Wo line maarne waale uncle zara bahir gaye hain&quot;</ThemedText>
                </View>

            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingTop: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    avatar: {
        width: 128,
        height: 128,
        borderRadius: 64,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
    },
    avatarText: {
        color: '#000',
        fontSize: 25,
        fontWeight: 'bold',
    },
    username: {
        fontSize: 24,
        marginBottom: 5,
    },
    handle: {
        fontSize: 16,
        opacity: 0.6,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        marginBottom: 15,
        opacity: 0.8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15
    },
    rowLabel: {
        fontSize: 16,
    },
    rowSubtext: {
        fontSize: 12,
        opacity: 0.6,
        marginTop: 2,
    },
    rowValue: {
        fontSize: 16,
        opacity: 0.6,
    },
    logoutButton: {
        marginTop: 20,
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 40,
    },
    footer: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    footerText: {
        fontSize: 12,
        fontStyle: 'italic',
        opacity: 0.5,
        textAlign: 'center',
    },
    rangeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rangeBtnText: {
        fontSize: 20,
        fontWeight: 'bold',
    }
});

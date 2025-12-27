import { StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, View } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ProfileScreen() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const [locationEnabled, setLocationEnabled] = useState(true); // Sync with actual preference later
    const [range, setRange] = useState(5); // Sync with actual preference later

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

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                        <ThemedText style={styles.avatarText}>
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </ThemedText>
                    </View>
                    <ThemedText type="title" style={styles.username}>
                        {user?.real_name || 'User'}
                    </ThemedText>
                    <ThemedText style={styles.handle}>@{user?.username}</ThemedText>
                </View>

                {/* Settings Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Preferences</ThemedText>

                    <View style={[styles.row, { borderBottomColor: theme.icon }]}>
                        <ThemedText style={styles.rowLabel}>Share Location</ThemedText>
                        <Switch
                            value={locationEnabled}
                            onValueChange={setLocationEnabled}
                            trackColor={{ false: '#767577', true: theme.tint }}
                        />
                    </View>

                    {/* Slider placeholder for Radius */}
                    <View style={[styles.row, { borderBottomColor: theme.icon }]}>
                        <View>
                            <ThemedText style={styles.rowLabel}>Discovery Radius</ThemedText>
                            <ThemedText style={styles.rowSubtext}>{range} km</ThemedText>
                        </View>
                        {/* Add Slider here if needed, or buttons */}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity onPress={() => setRange(Math.max(1, range - 1))}><ThemedText>-</ThemedText></TouchableOpacity>
                            <TouchableOpacity onPress={() => setRange(Math.min(50, range + 1))}><ThemedText>+</ThemedText></TouchableOpacity>
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
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatarText: {
        color: 'white',
        fontSize: 40,
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
    }
});

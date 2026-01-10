import { StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, View, ActivityIndicator, Modal, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiRequest } from '@/utils/api';
import { auth } from '@/utils/firebase';

const QUOTES = [
    "Wo line maarne waale uncle zara bahir gaye hain",
    "The best way to predict the future is to create it.",
    "In the end, we only regret the chances we didn't take.",
    "Happiness is only real when shared.",
    "Life is short. Make every connection count.",
    "Someone somewhere right now is beside someone else"
];

export default function ProfileScreen() {
    const { user: authUser, signOut } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [range, setRange] = useState(5);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        let timer: any;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);

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

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'We need access to your photos to change your profile picture.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                uploadAvatar(result.assets[0].uri);
            }
        } catch (e) {
            console.error('Pick image error', e);
            Alert.alert('Error', 'Failed to pick image');
        }
    }

    const uploadAvatar = async (uri: string) => {
        setSaving(true);
        try {
            const formData = new FormData();
            // Handle different names/types if needed, but for RN this is the standard pattern
            formData.append('image', {
                uri: uri,
                type: 'image/jpeg',
                name: 'avatar.jpg',
            } as any);

            const data = await apiRequest('/v1/image/upload', {
                method: 'POST',
                body: formData,
            });

            if (data.url) {
                await updateProfile({ avatar_url: data.url });
            }
        } catch (error) {
            console.error('Upload avatar error', error);
            Alert.alert('Error', 'Failed to upload profile picture');
        } finally {
            setSaving(false);
        }
    }

    const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
    const [isExpirationModalVisible, setIsExpirationModalVisible] = useState(false);
    const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
    const [isScheduleDatePickerVisible, setIsScheduleDatePickerVisible] = useState(false);
    const [isScheduleTimePickerVisible, setIsScheduleTimePickerVisible] = useState(false);
    const [isScheduleStatusInputVisible, setIsScheduleStatusInputVisible] = useState(false);
    const [isScheduleExpirationVisible, setIsScheduleExpirationVisible] = useState(false);
    const [scheduledTime, setScheduledTime] = useState(new Date(Date.now() + 60 * 60 * 1000)); // Default to 1 hour from now
    const [scheduledStatusText, setScheduledStatusText] = useState('');
    const [editMode, setEditMode] = useState<{ field: string, label: string, multiline?: boolean } | null>(null);
    const [tempValue, setTempValue] = useState('');
    const [tempName, setTempName] = useState('');

    const user = profile || authUser;
    const isEmailVerified = user?.email_verified;

    const handleUpdateName = () => {
        if (tempName.trim()) {
            updateProfile({ real_name: tempName.trim() });
            setIsEditNameModalVisible(false);
        }
    };

    const handleUpdateField = () => {
        if (editMode) {
            updateProfile({ [editMode.field]: tempValue.trim() });
            setEditMode(null);
        }
    };

    const setExpiration = (hours: number | null) => {
        const expiration = hours ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;
        updateProfile({ status_expiration: expiration });
        setIsExpirationModalVisible(false);
    };

    const setSchedule = (hours: number | null) => {
        if (hours === null) {
            updateProfile({ scheduled_status: null, scheduled_status_at: null, scheduled_status_expiration: null });
            setIsScheduleModalVisible(false);
        } else {
            const scheduleAt = new Date(Date.now() + hours * 60 * 60 * 1000);
            setScheduledTime(scheduleAt);
            setIsScheduleModalVisible(false);
            setIsScheduleStatusInputVisible(true);
        }
    };

    const confirmScheduledStatus = () => {
        if (!scheduledStatusText.trim()) {
            Alert.alert('Error', 'Please enter a status message');
            return;
        }
        setIsScheduleStatusInputVisible(false);
        setIsScheduleExpirationVisible(true);
    };

    const setScheduledExpiration = (hours: number | null) => {
        const expiration = hours ? new Date(scheduledTime.getTime() + hours * 60 * 60 * 1000).toISOString() : null;

        updateProfile({
            scheduled_status: scheduledStatusText.trim(),
            scheduled_status_at: scheduledTime.toISOString(),
            scheduled_status_expiration: expiration
        });

        setIsScheduleExpirationVisible(false);
        setScheduledStatusText('');
    };

    const handleResendVerification = async () => {
        if (resendCooldown > 0) return;

        setSaving(true);
        try {
            await apiRequest('/v1/user/resend-verification', { method: 'POST' });
            setResendCooldown(60);
            Alert.alert('Sent', 'Verification email has been sent to your address.');
        } catch (e: any) {
            console.error('Resend verification error', e);
            Alert.alert('Error', e.message || 'Failed to send verification email');
        } finally {
            setSaving(false);
        }
    }

    const validateEmail = (email: string) => {
        return String(email)
            .toLowerCase()
            .match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
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

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 80 }]}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={pickImage} disabled={saving}>
                        <View style={[styles.avatar, { backgroundColor: theme.tint, overflow: 'hidden' }]}>
                            {user?.avatar_url ? (
                                <Image
                                    source={{ uri: user.avatar_url }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            ) : (
                                <ThemedText style={styles.avatarText}>
                                    {(user?.username?.charAt(0).toUpperCase() || 'U')}
                                </ThemedText>
                            )}
                            {saving && (
                                <View style={styles.avatarOverlay}>
                                    <ActivityIndicator size="small" color="#fff" />
                                </View>
                            )}
                        </View>
                        <View style={styles.editBadge}>
                            <IconSymbol name="pencil" size={14} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <ThemedText numberOfLines={1} type="title" style={styles.username}>
                        {user?.real_name || 'User'}
                    </ThemedText>
                    <ThemedText style={styles.handle}>@{user?.username}</ThemedText>
                    {user?.status && (
                        <View style={[styles.statusBadge, { backgroundColor: theme.tint + '15' }]}>
                            <ThemedText style={[styles.statusText, { color: theme.tint }]}>
                                {user.status}
                            </ThemedText>
                        </View>
                    )}
                    {saving && <ThemedText style={{ fontSize: 12, color: theme.tint, marginTop: 5 }}>Saving...</ThemedText>}
                </View>

                {/* Account Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Account</ThemedText>

                    <TouchableOpacity
                        style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                        onPress={() => {
                            setTempName(user?.real_name || '');
                            setIsEditNameModalVisible(true);
                        }}
                    >
                        <View>
                            <ThemedText style={styles.rowLabel}>Full Name</ThemedText>
                            <ThemedText style={styles.rowSubtext}>{user?.real_name || 'Set your name'}</ThemedText>
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
                                    if (email) {
                                        if (validateEmail(email)) {
                                            updateProfile({ email });
                                        } else {
                                            Alert.alert('Invalid Email', 'Please enter a valid email address');
                                        }
                                    }
                                },
                                'plain-text',
                                user?.email
                            );
                        }}
                    >
                        <View>
                            <ThemedText style={styles.rowLabel}>Email</ThemedText>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <ThemedText style={styles.rowSubtext}>{user?.email || 'Not set'}</ThemedText>
                                {user?.email && (
                                    isEmailVerified ? (
                                        <IconSymbol name="checkmark.seal.fill" size={14} color="#4CAF50" />
                                    ) : (
                                        <IconSymbol name="exclamationmark.circle.fill" size={14} color="#FF9800" />
                                    )
                                )}
                            </View>
                        </View>
                        <IconSymbol name="envelope" size={16} color={theme.icon} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                        onPress={() => {
                            setTempValue(user?.status || '');
                            setEditMode({ field: 'status', label: 'My Status' });
                        }}
                    >
                        <View>
                            <ThemedText style={styles.rowLabel}>Current Status</ThemedText>
                            <ThemedText style={styles.rowSubtext}>{user?.status || 'What\'s on your mind?'}</ThemedText>
                        </View>
                        <IconSymbol name="pencil" size={16} color={theme.icon} />
                    </TouchableOpacity>

                    {user?.status && (
                        <TouchableOpacity
                            style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                            onPress={() => setIsExpirationModalVisible(true)}
                        >
                            <View>
                                <ThemedText style={styles.rowLabel}>Status Expiration</ThemedText>
                                <ThemedText style={styles.rowSubtext}>
                                    {user.status_expiration ? `Expires ${new Date(user.status_expiration).toLocaleString()}` : 'Never expires'}
                                </ThemedText>
                            </View>
                            <IconSymbol name="timer" size={16} color={theme.icon} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                        onPress={() => setIsScheduleModalVisible(true)}
                    >
                        <View>
                            <ThemedText style={styles.rowLabel}>Scheduled Status</ThemedText>
                            <ThemedText style={styles.rowSubtext}>
                                {user.scheduled_status ? `"${user.scheduled_status}" at ${new Date(user.scheduled_status_at).toLocaleString()}` : 'Plan a future update'}
                            </ThemedText>
                        </View>
                        <IconSymbol name="calendar" size={16} color={theme.icon} />
                    </TouchableOpacity>

                    {user?.email && !isEmailVerified && (
                        <View style={styles.verificationBox}>
                            <ThemedText style={styles.verificationText}>Email is not verified</ThemedText>
                            <TouchableOpacity
                                onPress={handleResendVerification}
                                disabled={resendCooldown > 0}
                                style={[styles.resendBtn, resendCooldown > 0 && { opacity: 0.5 }]}
                            >
                                <ThemedText style={styles.resendBtnText}>
                                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Public Profile Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Public Profile</ThemedText>

                    <TouchableOpacity
                        style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                        onPress={() => {
                            setTempValue(user?.bio || '');
                            setEditMode({ field: 'bio', label: 'About Me', multiline: true });
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <ThemedText style={styles.rowLabel}>Bio</ThemedText>
                            <ThemedText numberOfLines={2} style={styles.rowSubtext}>
                                {user?.bio || 'Add a short bio about yourself'}
                            </ThemedText>
                        </View>
                        <IconSymbol name="pencil" size={16} color={theme.icon} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                        onPress={() => {
                            setTempValue(user?.website || '');
                            setEditMode({ field: 'website', label: 'Website' });
                        }}
                    >
                        <View>
                            <ThemedText style={styles.rowLabel}>Website</ThemedText>
                            <ThemedText style={styles.rowSubtext}>{user?.website || 'Add your website link'}</ThemedText>
                        </View>
                        <IconSymbol name="link" size={16} color={theme.icon} />
                    </TouchableOpacity>

                    <View style={[styles.row, { borderBottomColor: theme.icon + '20' }]}>
                        <View>
                            <ThemedText style={styles.rowLabel}>Business Account</ThemedText>
                            <ThemedText style={styles.rowSubtext}>Display business info to everyone</ThemedText>
                        </View>
                        <Switch
                            value={user?.is_business || false}
                            onValueChange={(val) => updateProfile({ is_business: val })}
                            trackColor={{ false: '#767577', true: theme.tint }}
                        />
                    </View>

                    {user?.is_business && (
                        <>
                            <TouchableOpacity
                                style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                                onPress={() => {
                                    setTempValue(user?.business_type || '');
                                    setEditMode({ field: 'business_type', label: 'Business Category' });
                                }}
                            >
                                <View>
                                    <ThemedText style={styles.rowLabel}>Category</ThemedText>
                                    <ThemedText style={styles.rowSubtext}>{user?.business_type || 'e.g. Cafe, Tech, Art'}</ThemedText>
                                </View>
                                <IconSymbol name="tag" size={16} color={theme.icon} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.row, { borderBottomColor: theme.icon + '20' }]}
                                onPress={() => {
                                    setTempValue(user?.public_phone || '');
                                    setEditMode({ field: 'public_phone', label: 'Public Contact Phone' });
                                }}
                            >
                                <View>
                                    <ThemedText style={styles.rowLabel}>Public Phone</ThemedText>
                                    <ThemedText style={styles.rowSubtext}>{user?.public_phone || 'Add a phone number for customers'}</ThemedText>
                                </View>
                                <IconSymbol name="phone.fill" size={16} color={theme.icon} />
                            </TouchableOpacity>
                        </>
                    )}
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

                    <TouchableOpacity style={[styles.row, { borderBottomColor: theme.icon }]} onPress={() => router.push('/meetings')}>
                        <ThemedText style={styles.rowLabel}>Meetings</ThemedText>
                        <IconSymbol name="chevron.right" size={20} color={theme.icon} />
                    </TouchableOpacity>

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
                        <ThemedText style={styles.rowLabel}>An app by</ThemedText>
                        <ThemedText style={styles.rowValue}>Habeebullah Wattoo</ThemedText>
                    </View>

                    {/* <View style={[styles.row, { borderBottomColor: theme.icon }]}>
                        <ThemedText style={styles.rowLabel}>Developed by</ThemedText>
                        <ThemedText style={styles.rowValue}>Muhammad Ali</ThemedText>
                    </View> */}
                </View>

                {/* Business Tools */}
                {user?.is_business && false && (
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Business Tools</ThemedText>
                        <TouchableOpacity style={[styles.row, { borderBottomColor: theme.icon }]} onPress={() => router.push('/meetings/create')}>
                            <ThemedText style={styles.rowLabel}>Create New Meeting</ThemedText>
                            <IconSymbol name="calendar.badge.plus" size={20} color={theme.tint} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Logout */}
                <TouchableOpacity style={[styles.logoutButton, { borderColor: 'red' }]} onPress={handleLogout}>
                    <ThemedText style={{ color: 'red', fontWeight: 'bold' }}>Log Out</ThemedText>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <ThemedText style={styles.footerText}>"{QUOTES[new Date().getDate() % QUOTES.length]}"</ThemedText>
                </View>

            </ScrollView>

            {/* Edit Name Modal */}
            <Modal
                visible={isEditNameModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEditNameModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText type="subtitle" style={{ marginBottom: 15 }}>Edit Full Name</ThemedText>
                        <TextInput
                            style={[styles.modalInput, { color: theme.text, borderColor: theme.icon + '40' }]}
                            value={tempName}
                            onChangeText={setTempName}
                            placeholder="Enter your full name"
                            placeholderTextColor="#888"
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.icon + '20' }]}
                                onPress={() => setIsEditNameModalVisible(false)}
                            >
                                <ThemedText>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                                onPress={handleUpdateName}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Save</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </ThemedView>
                </View>
            </Modal>

            {/* Expiration Modal */}
            <Modal
                visible={isExpirationModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsExpirationModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText type="subtitle" style={{ marginBottom: 15 }}>Clear Status After...</ThemedText>
                        <View style={styles.presetList}>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setExpiration(1)}>
                                <ThemedText>1 Hour</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setExpiration(4)}>
                                <ThemedText>4 Hours</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setExpiration(24)}>
                                <ThemedText>24 Hours</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setExpiration(null)}>
                                <ThemedText style={{ color: 'red' }}>Never Clear</ThemedText>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.modalBtn, { marginTop: 10, alignSelf: 'flex-end' }]}
                            onPress={() => setIsExpirationModalVisible(false)}
                        >
                            <ThemedText>Close</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </View>
            </Modal>

            {/* Schedule Modal */}
            <Modal
                visible={isScheduleModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsScheduleModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText type="subtitle" style={{ marginBottom: 15 }}>Schedule Status Update</ThemedText>
                        <ThemedText style={{ marginBottom: 20, opacity: 0.7 }}>Pick when your status should go live</ThemedText>

                        <View style={{ marginBottom: 20 }}>
                            <ThemedText style={{ fontSize: 16, marginBottom: 10, fontWeight: '600' }}>Selected Time:</ThemedText>
                            <ThemedText style={{ fontSize: 15, color: theme.tint }}>
                                {scheduledTime.toLocaleString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                            </ThemedText>
                        </View>

                        <View style={styles.presetList}>
                            <TouchableOpacity
                                style={[styles.presetBtn, { backgroundColor: theme.tint }]}
                                onPress={() => {
                                    setIsScheduleModalVisible(false);
                                    setIsScheduleDatePickerVisible(true);
                                }}
                            >
                                <IconSymbol name="calendar" size={20} color="white" />
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Pick Date & Time</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setSchedule(null)}>
                                <ThemedText style={{ color: 'red' }}>Clear Scheduled</ThemedText>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.modalBtn, { marginTop: 10, alignSelf: 'flex-end' }]}
                            onPress={() => setIsScheduleModalVisible(false)}
                        >
                            <ThemedText>Close</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </View>
            </Modal>

            {/* Native Date Picker for Schedule */}
            {isScheduleDatePickerVisible && (
                <DateTimePicker
                    value={scheduledTime}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {
                            setIsScheduleDatePickerVisible(false);
                        }
                        if (selectedDate) {
                            setScheduledTime(selectedDate);
                            if (Platform.OS === 'android') {
                                // On Android, show time picker after date is selected
                                setTimeout(() => setIsScheduleTimePickerVisible(true), 100);
                            } else {
                                // On iOS, show time picker immediately
                                setIsScheduleDatePickerVisible(false);
                                setIsScheduleTimePickerVisible(true);
                            }
                        }
                    }}
                />
            )}

            {/* Native Time Picker for Schedule */}
            {isScheduleTimePickerVisible && (
                <DateTimePicker
                    value={scheduledTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setIsScheduleTimePickerVisible(false);
                        if (selectedDate) {
                            setScheduledTime(selectedDate);
                            // After time is selected, show status input
                            setIsScheduleStatusInputVisible(true);
                        }
                    }}
                />
            )}

            {/* Status Input Modal */}
            <Modal
                visible={isScheduleStatusInputVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsScheduleStatusInputVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText type="subtitle" style={{ marginBottom: 15 }}>What's Your Status?</ThemedText>
                        <ThemedText style={{ marginBottom: 15, opacity: 0.7 }}>
                            This will go live on {scheduledTime.toLocaleString()}
                        </ThemedText>
                        <TextInput
                            style={[styles.modalInput, { color: theme.text, borderColor: theme.icon + '40', height: 100, textAlignVertical: 'top' }]}
                            value={scheduledStatusText}
                            onChangeText={setScheduledStatusText}
                            placeholder="Enter your status..."
                            placeholderTextColor="#888"
                            multiline
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.icon + '20' }]}
                                onPress={() => setIsScheduleStatusInputVisible(false)}
                            >
                                <ThemedText>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                                onPress={confirmScheduledStatus}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Next</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </ThemedView>
                </View>
            </Modal>

            {/* Schedule Expiration Modal */}
            <Modal
                visible={isScheduleExpirationVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsScheduleExpirationVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText type="subtitle" style={{ marginBottom: 15 }}>When Should It Expire?</ThemedText>
                        <ThemedText style={{ marginBottom: 15, opacity: 0.7 }}>
                            After going live on {scheduledTime.toLocaleString()}
                        </ThemedText>
                        <View style={styles.presetList}>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setScheduledExpiration(1)}>
                                <ThemedText>1 Hour After</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setScheduledExpiration(4)}>
                                <ThemedText>4 Hours After</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setScheduledExpiration(24)}>
                                <ThemedText>24 Hours After</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, { backgroundColor: theme.icon + '10' }]} onPress={() => setScheduledExpiration(null)}>
                                <ThemedText style={{ color: 'red' }}>Never Expire</ThemedText>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.modalBtn, { marginTop: 10, alignSelf: 'flex-end' }]}
                            onPress={() => setIsScheduleExpirationVisible(false)}
                        >
                            <ThemedText>Cancel</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </View>
            </Modal>

            {/* Edit Field Modal */}
            <Modal
                visible={!!editMode}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setEditMode(null)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText type="subtitle" style={{ marginBottom: 15 }}>Edit {editMode?.label}</ThemedText>
                        <TextInput
                            style={[
                                styles.modalInput,
                                { color: theme.text, borderColor: theme.icon + '40' },
                                editMode?.multiline && { height: 100, textAlignVertical: 'top', paddingTop: 10 }
                            ]}
                            value={tempValue}
                            onChangeText={setTempValue}
                            placeholder={`Enter your ${editMode?.label?.toLowerCase()}`}
                            placeholderTextColor="#888"
                            multiline={editMode?.multiline}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.icon + '20' }]}
                                onPress={() => setEditMode(null)}
                            >
                                <ThemedText>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                                onPress={handleUpdateField}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Save</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </ThemedView>
                </View>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
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
        marginBottom: 10,
    },
    avatarText: {
        color: '#fff',
        fontSize: 50,
        fontWeight: 'bold',
    },
    avatarOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBadge: {
        position: 'absolute',
        bottom: 12,
        right: 5,
        backgroundColor: '#000',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff5',
    },
    username: {
        fontSize: 24,
        marginBottom: 5,
    },
    handle: {
        fontSize: 14,
        opacity: 0.6,
    },
    statusBadge: {
        marginTop: 10,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 15,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '600',
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
    verificationBox: {
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginTop: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    verificationText: {
        fontSize: 12,
        color: '#FF9800',
    },
    resendBtn: {
        backgroundColor: '#FF9800',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
    },
    resendBtnText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
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
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    modalInput: {
        height: 50,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 15,
        fontSize: 16,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    modalBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    presetList: {
        gap: 10,
    },
    presetBtn: {
        height: 50,
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
    }
});

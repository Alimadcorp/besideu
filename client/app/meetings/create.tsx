import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { apiRequest } from '@/utils/api';

export default function CreateMeetingScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [locationName, setLocationName] = useState('');
    const [threshold, setThreshold] = useState(1.0);
    const [hasChannel, setHasChannel] = useState(false);
    const [creating, setCreating] = useState(false);

    // Simplistic location handling - defaults to current location
    const [coords, setCoords] = useState<{ lat: number, lon: number } | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);

    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000)); // +1 hour

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // Invitee logic
    const [friends, setFriends] = useState<any[]>([]);
    const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(new Set());
    const [showInviteModal, setShowInviteModal] = useState(false);

    useEffect(() => {
        fetchContactsAndFriends();
    }, []);

    const fetchContactsAndFriends = async () => {
        try {
            const [friendsData, contactsData] = await Promise.all([
                apiRequest('/v1/friends/list'),
                apiRequest('/v1/contacts/list')
            ]);

            const all = [
                ...(friendsData.friends || []).map((f: any) => ({ ...f, type: 'friend', id: f.friend_id })),
                ...(contactsData.matched || []).map((c: any) => ({ ...c, type: 'contact', id: c.user_id, real_name: c.contact_name || c.username }))
            ];

            // Deduplicate by ID
            const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
            setFriends(unique);
        } catch (e) {
            console.log('Failed to fetch invitees', e);
        }
    };

    const toggleInvitee = (id: string) => {
        const next = new Set(selectedInvitees);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedInvitees(next);
    };

    const getCurrentLocation = async () => {
        setGettingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required to set meeting location');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            setCoords({
                lat: location.coords.latitude,
                lon: location.coords.longitude
            });

            // Try to reverse geocode
            const reverse = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });

            if (reverse && reverse[0]) {
                const addr = reverse[0];
                const name = [addr.name, addr.street, addr.city].filter(Boolean).join(', ');
                setLocationName(name);
            } else {
                setLocationName('Use Current Location');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to get location');
        } finally {
            setGettingLocation(false);
        }
    };

    const handleCreate = async () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a title');
            return;
        }
        if (!coords) {
            Alert.alert('Error', 'Please set a location');
            return;
        }

        setCreating(true);
        try {
            const response = await apiRequest('/v1/meetings/create', {
                method: 'POST',
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    location: {
                        lat: coords.lat,
                        lon: coords.lon,
                        name: locationName.trim() || 'Custom Location'
                    },
                    threshold_km: threshold,
                    starts_at: startDate.toISOString(),
                    ends_at: endDate.toISOString(),
                    has_channel: hasChannel,
                    invite_user_ids: Array.from(selectedInvitees)
                })
            });

            if (response.success) {
                Alert.alert('Success', 'Meeting created successfully!', [
                    { text: 'OK', onPress: () => router.replace('/meetings') }
                ]);
            }
        } catch (error: any) {
            console.error('Create meeting error', error);
            if (error.message?.includes('not_business')) {
                Alert.alert('Business Only', 'Only business profiles can create meetings. Please upgrade your account.');
            } else {
                Alert.alert('Error', error.message || 'Failed to create meeting');
            }
        } finally {
            setCreating(false);
        }
    };

    // Reusable DateTime Picker Modal Component logic would go here, simplified custom picker:
    const renderDatePicker = (
        visible: boolean,
        onClose: () => void,
        date: Date,
        setDate: (d: Date) => void,
        minDate?: Date
    ) => (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <ThemedView style={styles.modalContent}>
                    <ThemedText type="subtitle" style={{ marginBottom: 20 }}>Select Date & Time</ThemedText>
                    <ThemedText style={{ marginBottom: 20, textAlign: 'center' }}>
                        {date.toLocaleString()}
                    </ThemedText>

                    <View style={styles.pickerControls}>
                        <View style={styles.row}>
                            <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                                const d = new Date(date);
                                d.setDate(d.getDate() - 1);
                                if (minDate && d < minDate) return;
                                setDate(d);
                            }}><ThemedText>-1 Day</ThemedText></TouchableOpacity>
                            <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                                const d = new Date(date);
                                d.setDate(d.getDate() + 1);
                                setDate(d);
                            }}><ThemedText>+1 Day</ThemedText></TouchableOpacity>
                        </View>
                        <View style={styles.row}>
                            <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                                const d = new Date(date);
                                d.setHours(d.getHours() - 1);
                                if (minDate && d < minDate) return;
                                setDate(d);
                            }}><ThemedText>-1 Hr</ThemedText></TouchableOpacity>
                            <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                                const d = new Date(date);
                                d.setHours(d.getHours() + 1);
                                setDate(d);
                            }}><ThemedText>+1 Hr</ThemedText></TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.btn, { marginTop: 20, backgroundColor: theme.tint }]} onPress={onClose}>
                        <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Confirm</ThemedText>
                    </TouchableOpacity>
                </ThemedView>
            </View>
        </Modal>
    );

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ title: 'Create Meeting' }} />
            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Title</ThemedText>
                    <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.icon + '40' }]}
                        placeholder="Meeting Title"
                        placeholderTextColor="#999"
                        value={title}
                        onChangeText={setTitle}
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Description</ThemedText>
                    <TextInput
                        style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.icon + '40' }]}
                        placeholder="What is this meeting about?"
                        placeholderTextColor="#999"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Location</ThemedText>
                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.icon + '40' }]}
                            placeholder="Location Name"
                            placeholderTextColor="#999"
                            value={locationName}
                            onChangeText={setLocationName}
                        />
                        <TouchableOpacity
                            style={[styles.iconBtn, { backgroundColor: theme.tint + '20' }]}
                            onPress={getCurrentLocation}
                            disabled={gettingLocation}
                        >
                            {gettingLocation ? (
                                <ActivityIndicator size="small" color={theme.tint} />
                            ) : (
                                <IconSymbol size={24} name="location.fill" color={theme.tint} />
                            )}
                        </TouchableOpacity>
                    </View>
                    {coords && <ThemedText style={styles.coordinates}>{coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}</ThemedText>}
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Start Time</ThemedText>
                    <TouchableOpacity
                        style={[styles.input, { justifyContent: 'center', borderColor: theme.icon + '40' }]}
                        onPress={() => setShowStartPicker(true)}
                    >
                        <ThemedText>{startDate.toLocaleString()}</ThemedText>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>End Time</ThemedText>
                    <TouchableOpacity
                        style={[styles.input, { justifyContent: 'center', borderColor: theme.icon + '40' }]}
                        onPress={() => setShowEndPicker(true)}
                    >
                        <ThemedText>{endDate.toLocaleString()}</ThemedText>
                    </TouchableOpacity>
                </View>



                <View style={styles.section}>
                    <ThemedText style={styles.label}>Invite People</ThemedText>
                    <TouchableOpacity
                        style={[styles.input, { justifyContent: 'center', borderColor: theme.icon + '40' }]}
                        onPress={() => setShowInviteModal(true)}
                    >
                        <ThemedText>
                            {selectedInvitees.size === 0
                                ? 'Select friends to invite...'
                                : `${selectedInvitees.size} people selected`}
                        </ThemedText>
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View>
                        <ThemedText style={styles.label}>Create Group Chat</ThemedText>
                        <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>Automatically create a channel</ThemedText>
                    </View>
                    <Switch
                        value={hasChannel}
                        onValueChange={setHasChannel}
                        trackColor={{ true: theme.tint }}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.btn, { backgroundColor: theme.tint, marginTop: 20 }]}
                    onPress={handleCreate}
                    disabled={creating}
                >
                    {creating ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <ThemedText style={styles.btnText}>Create Meeting</ThemedText>
                    )}
                </TouchableOpacity>

            </ScrollView>

            {renderDatePicker(showStartPicker, () => setShowStartPicker(false), startDate, setStartDate)}
            {renderDatePicker(showEndPicker, () => setShowEndPicker(false), endDate, setEndDate, startDate)}

            <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => setShowInviteModal(false)}>
                <View style={styles.modalOverlay}>
                    <ThemedView style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <ThemedText type="subtitle" style={{ marginBottom: 15 }}>Invite Friends</ThemedText>
                        <ScrollView style={{ width: '100%' }}>
                            {friends.map((friend) => (
                                <TouchableOpacity
                                    key={friend.id}
                                    style={[styles.inviteItem, selectedInvitees.has(friend.id) && { backgroundColor: theme.tint + '20' }]}
                                    onPress={() => toggleInvitee(friend.id)}
                                >
                                    <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                                        <ThemedText style={{ color: 'white' }}>{friend.username?.[0]?.toUpperCase()}</ThemedText>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <ThemedText type="defaultSemiBold">{friend.real_name || friend.username}</ThemedText>
                                        <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>@{friend.username}</ThemedText>
                                    </View>
                                    {selectedInvitees.has(friend.id) && <IconSymbol name="checkmark.circle.fill" size={24} color={theme.tint} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.btn, { marginTop: 20, backgroundColor: theme.tint, width: '100%' }]}
                            onPress={() => setShowInviteModal(false)}
                        >
                            <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Done</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </View>
            </Modal>
        </ThemedView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
        gap: 20,
    },
    section: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        minHeight: 48,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    coordinates: {
        fontSize: 12,
        opacity: 0.5,
        marginTop: 4,
    },
    btn: {
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
    },
    pickerControls: {
        gap: 15,
        width: '100%',
    },
    pickerBtn: {
        flex: 1,
        padding: 10,
        backgroundColor: 'rgba(150, 150, 150, 0.1)',
        borderRadius: 8,
        alignItems: 'center',
    },
    inviteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

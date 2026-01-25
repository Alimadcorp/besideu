import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TextInput, FlatList, Platform, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, Keyboard, Animated } from 'react-native';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import { addSocketListener } from '@/utils/socket';

// Format time as HH:MM
const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return format(date, 'HH:mm');
};

// Format date header (like WhatsApp)
const formatDateHeader = (timestamp: string): string => {
    const date = new Date(timestamp);
    if (isToday(date)) {
        return 'Today';
    } else if (isYesterday(date)) {
        return 'Yesterday';
    } else {
        return format(date, 'EEEE, MMMM d, yyyy');
    }
};

type Message = {
    id: string;
    text: string;
    sender_id: string;
    timestamp: string;
    image_url?: string;
    reactions?: Record<string, string>; // userId -> reaction char
    meetup_request?: {
        id: string;
        status: 'pending' | 'accepted' | 'declined' | 'expired';
        location: any;
    };
};

type Reaction = {
    message_id: string;
    reaction: string;
    user_id: string;
    timestamp: string;
};

type ChatData = {
    dm_id: string;
    user: {
        id: string;
        username: string;
        real_name?: string;
        avatar_url?: string;
    };
    messages: Message[];
    reactions: Reaction[];
};

export default function ChatScreen() {
    const { id, type, meetup } = useLocalSearchParams();
    const processedMeetupRef = useRef(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatUser, setChatUser] = useState<ChatData['user'] | null>(null);
    const [userProfile, setUserProfile] = useState<{ is_online?: boolean; last_online?: string } | null>(null);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleDate, setScheduleDate] = useState(new Date(Date.now() + 60 * 60 * 1000)); // Default to 1 hour from now
    const [activeMeetupId, setActiveMeetupId] = useState<string | null>(null); // For tracking location
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const keyboardHeight = useRef(new Animated.Value(0)).current;
    const [keyboardPadding, setKeyboardPadding] = useState(0);

    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const lastMessageTimestamp = useRef<string | undefined>(undefined);

    // Fetch user profile for online status
    const fetchUserProfile = useCallback(async (userId: string) => {
        try {
            const data = await apiRequest(`/v1/user/${userId}/profile`);
            setUserProfile(data.profile);
        } catch (error) {
            console.error('Failed to fetch user profile', error);
        }
    }, []);

    const fetchMessages = useCallback(async (after?: string) => {
        try {
            let url = `/v1/messages/${id}/get`;
            const params = new URLSearchParams();
            if (after) params.append('after', after);
            if (type) params.append('type', type as string);

            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;
            const data: ChatData = await apiRequest(url);

            if (!after) {
                // Initial load
                setChatUser(data.user);
                setMessages(data.messages.reverse()); // Show newest at bottom
                if (data.messages.length > 0) {
                    lastMessageTimestamp.current = data.messages[0].timestamp;
                }
                // Fetch user profile for online status only for 1:1 chats
                if (data.user?.id && !(data.user as any).is_meeting && type !== 'meeting') {
                    fetchUserProfile(data.user.id);
                }
            } else {
                // Append new messages
                if (data.messages.length > 0) {
                    setMessages(prev => [...data.messages.reverse(), ...prev]);
                    lastMessageTimestamp.current = data.messages[0].timestamp;
                }
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const markAsRead = useCallback(async () => {
        try {
            await apiRequest(`/v1/messages/${id}/read`, { method: 'POST' });
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    }, [id]);

    useEffect(() => {
        fetchMessages().then(() => markAsRead());

        const removeListener = addSocketListener((msg) => {
            if (msg.type === 'new_message' && msg.payload.dm_id === id) {
                console.log('New message received via socket', msg);
                fetchMessages(lastMessageTimestamp.current).then(() => markAsRead());
            }
        });

        // Refresh user profile periodically to update online status
        const profileInterval = setInterval(() => {
            if (chatUser?.id && !(chatUser as any).is_meeting && type !== 'meeting') {
                fetchUserProfile(chatUser.id);
            }
        }, 30000); // Every 30 seconds

        return () => {
            removeListener();
            clearInterval(profileInterval);
        };
    }, [fetchMessages, id, markAsRead, chatUser?.id, fetchUserProfile]);

    // Active Meetup Location Tracking
    useEffect(() => {
        if (!activeMeetupId) return;

        let startTime = Date.now();
        const intervalId = setInterval(async () => {
            if (Date.now() - startTime > 60 * 60 * 1000) { // 1 hour limit
                setActiveMeetupId(null);
                clearInterval(intervalId);
                return;
            }

            try {
                const location = await Location.getCurrentPositionAsync({});
                await apiRequest(`/v1/meetups/${activeMeetupId}/respond`, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'update_location',
                        location: {
                            lat: location.coords.latitude,
                            long: location.coords.longitude,
                            alt: location.coords.altitude
                        }
                    })
                });
                console.log('Updated meetup location');
            } catch (e) {
                console.error('Failed to update meetup location', e);
            }
        }, 60000); // Every 1 minute

        return () => clearInterval(intervalId);
    }, [activeMeetupId]);

    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                Animated.timing(keyboardHeight, {
                    duration: Platform.OS === 'ios' ? e.duration : 250,
                    toValue: e.endCoordinates.height,
                    useNativeDriver: false,
                }).start();
                setKeyboardPadding(e.endCoordinates.height);
            }
        );

        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            (e) => {
                Animated.timing(keyboardHeight, {
                    duration: Platform.OS === 'ios' ? e.duration : 250,
                    toValue: 0,
                    useNativeDriver: false,
                }).start();
                setKeyboardPadding(0);
            }
        );

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, [keyboardHeight]);

    const sendMessage = async (textOverride?: string, imageUrl?: string, scheduledAt?: string) => {
        const textToSend = textOverride !== undefined ? textOverride : inputText;
        if (!textToSend.trim() && !imageUrl) return;

        if (textOverride === undefined) setInputText('');
        setSending(true);

        try {
            // Handle meeting channel messages differently
            if (type === 'meeting') {
                const meetingId = (chatUser as any)?.meeting_id;
                if (!meetingId) {
                    throw new Error('Meeting ID not found');
                }
                
                const response = await apiRequest(`/v1/meetings/${meetingId}/channel/messages`, {
                    method: 'POST',
                    body: JSON.stringify({
                        text: textToSend,
                        image_url: imageUrl,
                    }),
                });

                if (response.success && response.message) {
                    const newMessage: Message = {
                        id: response.message.id,
                        text: textToSend,
                        image_url: imageUrl,
                        sender_id: user!.id,
                        timestamp: response.message.timestamp,
                    };
                    setMessages(prev => [newMessage, ...prev]);
                }
            } else {
                // Regular DM message
                const response = await apiRequest(`/v1/messages/${id}/send`, {
                    method: 'POST',
                    body: JSON.stringify({
                        text: textToSend,
                        image_url: imageUrl,
                        timestamp: new Date().toISOString(),
                        scheduled_at: scheduledAt,
                    }),
                });

                if (scheduledAt) {
                    Alert.alert('Scheduled', 'Your message will be sent at ' + new Date(scheduledAt).toLocaleString());
                } else {
                    const newMessage: Message = {
                        id: response.message_id,
                        text: textToSend,
                        image_url: imageUrl,
                        sender_id: user!.id,
                        timestamp: response.timestamp,
                    };
                    setMessages(prev => [newMessage, ...prev]);
                }
            }
        } catch (error: any) {
            console.error('Failed to send message:', error);
            if (textOverride === undefined) setInputText(textToSend);
            Alert.alert('Error', error.message || 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                uploadAndSendImage(result.assets[0].uri);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadAndSendImage = async (uri: string) => {
        setSending(true);
        try {
            const formData = new FormData();
            formData.append('image', {
                uri,
                type: 'image/jpeg',
                name: 'chat_image.jpg',
            } as any);

            const uploadData = await apiRequest('/v1/image/upload', {
                method: 'POST',
                body: formData,
            });

            if (uploadData.url) {
                await sendMessage('', uploadData.url);
            }
        } catch (error) {
            console.error('Image upload failed', error);
            Alert.alert('Error', 'Failed to upload image');
        } finally {
            setSending(false);
        }
    };

    const requestMeetup = useCallback(async () => {
        Alert.alert(
            'Request Meetup',
            'Do you want to send a meetup request to this user?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Request',
                    onPress: async () => {
                        try {
                            const response = await apiRequest(`/v1/messages/${id}/send`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    text: 'I sent a meetup request!',
                                    meetup: true,
                                    timestamp: new Date().toISOString(),
                                }),
                            });
                            const newMessage: Message = {
                                id: response.message_id,
                                text: 'I sent a meetup request!',
                                sender_id: user!.id,
                                timestamp: response.timestamp,
                                meetup_request: {
                                    id: 'temp',
                                    status: 'pending',
                                    location: null
                                }
                            };
                            setMessages(prev => [newMessage, ...prev]);
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to send request');
                        }
                    }
                }
            ]
        );
    }, [id, user]);

    useEffect(() => {
        if (meetup === 'true' && !processedMeetupRef.current && !loading) {
            processedMeetupRef.current = true;
            // Short delay to ensure loading is done
            setTimeout(() => {
                requestMeetup();
            }, 500);
        }
    }, [meetup, loading, requestMeetup]);

    const acceptMeetup = async (messageId: string, requestId: string) => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required.');
                return;
            }

            setLoading(true);
            const location = await Location.getCurrentPositionAsync({});

            await apiRequest(`/v1/meetups/${requestId}/respond`, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'accepted',
                    location: {
                        lat: location.coords.latitude,
                        long: location.coords.longitude,
                        alt: location.coords.altitude
                    }
                })
            });

            Alert.alert('Success', 'Meetup accepted! Location sharing enabled for 1 hour.');
            setActiveMeetupId(requestId);
            fetchMessages();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to accept meetup');
        } finally {
            setLoading(false);
        }
    };

    const openInMaps = (lat: number, lng: number) => {
        const url = Platform.select({
            ios: `maps:0,0?q=${lat},${lng}`,
            android: `geo:0,0?q=${lat},${lng}`,
            default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        });
        Linking.openURL(url);
    };

    const handleDoubleTap = async (messageId: string) => {
        try {
            await apiRequest(`/v1/messages/${id}/react`, {
                method: 'POST',
                body: JSON.stringify({ message_id: messageId, reaction: '❤️' })
            });
            fetchMessages();
        } catch (e) {
            console.log('Reaction failed', e);
        }
    };

    const formatDateHeader = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) {
            return 'Today';
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }

        return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    };

    // Group messages with date headers
    const groupedMessages = React.useMemo(() => {
        const grouped: Array<
            { type: "date"; date: string } | { type: "message"; message: Message }
        > = [];

        let lastDate: string | null = null;

        messages.forEach((msg, index) => {
            const msgDate = format(new Date(msg.timestamp), "yyyy-MM-dd");

            grouped.push({ type: "message", message: msg });

            const nextMsg = messages[index + 1];
            const nextDate = nextMsg
                ? format(new Date(nextMsg.timestamp), "yyyy-MM-dd")
                : null;

            if (msgDate !== nextDate) {
                grouped.push({ type: "date", date: msg.timestamp });
            }

            lastDate = msgDate;
        });

        return grouped;
    }, [messages]);

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sender_id === user?.id;
        let lastTap = 0;

        const handlePress = () => {
            const now = Date.now();
            if (now - lastTap < 500) {
                handleDoubleTap(item.id);
            }
            lastTap = now;
        };

        const meetupRequest = item.meetup_request;
        const isExpired = meetupRequest?.status === 'expired' ||
            (meetupRequest?.status === 'pending' && (Date.now() - new Date(item.timestamp).getTime() > 24 * 60 * 60 * 1000));
        const displayStatus = isExpired ? 'expired' : meetupRequest?.status;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={handlePress}
                style={[
                    styles.messageContainer,
                    isMe ? styles.myMessageContainer : styles.theirMessageContainer
                ]}>
                <View style={[
                    styles.messageBubble,
                    isMe ? { backgroundColor: theme.tint } : { backgroundColor: theme.icon + '15' },
                    isMe ? styles.myBubbleRadius : styles.theirBubbleRadius,
                    item.meetup_request ? styles.meetupBubble : {}
                ]}>
                    {item.image_url && (
                        <Image
                            source={{ uri: item.image_url }}
                            style={styles.messageImage}
                            contentFit="cover"
                        />
                    )}
                    {item.text ? (
                        <ThemedText style={[
                            styles.messageText,
                            isMe ? (colorScheme === 'dark' ? { color: '#000' } : { color: 'white' }) : { color: theme.text }
                        ]}>
                            {item.text}
                        </ThemedText>
                    ) : null}

                    <View style={styles.messageFooter}>
                        <ThemedText style={[
                            styles.timestamp,
                            isMe ? (colorScheme === 'dark' ? { color: 'rgba(0,0,0,0.5)' } : { color: 'rgba(255,255,255,0.7)' }) : { color: theme.icon + '80' }
                        ]}>
                            {formatTime(item.timestamp)}
                        </ThemedText>
                    </View>
                </View>

                {item.reactions && Object.keys(item.reactions).length > 0 && (
                    <View style={[styles.reactionContainer, isMe ? { right: 4 } : { left: 4 }]}>
                        <ThemedText style={{ fontSize: 13 }}>
                            {Object.values(item.reactions).join('')}
                        </ThemedText>
                    </View>
                )}

                {item.meetup_request && (
                    <View style={[styles.meetupContainer, { borderColor: theme.tint, backgroundColor: theme.background }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <IconSymbol name="location.circle.fill" size={22} color={theme.tint} />
                            <ThemedText type="defaultSemiBold">Meetup Request</ThemedText>
                        </View>
                        <ThemedText style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>
                            Status: <ThemedText type="defaultSemiBold" style={{
                                textTransform: 'uppercase',
                                fontSize: 12,
                                color: displayStatus === 'expired' ? '#FF3B30' : theme.text
                            }}>{displayStatus}</ThemedText>
                        </ThemedText>

                        {/* Expired State */}
                        {displayStatus === 'expired' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -8, marginBottom: 4 }}>
                                <IconSymbol name="exclamationmark.circle.fill" size={14} color="#FF3B30" />
                                <ThemedText style={{ color: '#FF3B30', fontSize: 12 }}>This request has expired.</ThemedText>
                            </View>
                        )}

                        {displayStatus === 'pending' && !isMe && (
                            <TouchableOpacity
                                style={[styles.meetupBtn, { backgroundColor: theme.tint }]}
                                onPress={() => acceptMeetup(item.id, item.meetup_request!.id)}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Share Location</ThemedText>
                            </TouchableOpacity>
                        )}

                        {item.meetup_request.status === 'accepted' && (
                            <View style={{ gap: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <IconSymbol name="checkmark.circle.fill" size={16} color="#34C759" />
                                    <ThemedText style={{ color: '#34C759', fontWeight: 'bold' }}>Location Shared</ThemedText>
                                </View>
                                {item.meetup_request.location && (
                                    <TouchableOpacity
                                        style={[styles.meetupBtn, { backgroundColor: '#34C759' }]}
                                        onPress={() => openInMaps(item.meetup_request!.location.lat, item.meetup_request!.location.long)}
                                    >
                                        <IconSymbol name="location.fill" size={16} color="white" />
                                        <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>View on Map</ThemedText>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.tint} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => {
                        const isMeeting = (chatUser as any)?.is_meeting;
                        return (
                            <TouchableOpacity
                                onPress={() => isMeeting ? router.push(`/meetings/${(chatUser as any).meeting_id}` as any) : router.push(`/user/${chatUser?.id}` as any)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                            >
                                <View style={[styles.headerAvatar, { backgroundColor: isMeeting ? theme.text : theme.tint }]}>
                                    {isMeeting ? (
                                        <IconSymbol name="person.3.fill" size={24} color={theme.background} />
                                    ) : chatUser?.avatar_url ? (
                                        <Image source={{ uri: chatUser.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                    ) : (
                                        <ThemedText style={styles.headerAvatarText}>{chatUser?.username.charAt(0).toUpperCase()}</ThemedText>
                                    )}
                                </View>
                                <View style={{ flex: 1, maxWidth: 200 }}>
                                    <ThemedText numberOfLines={1} type="defaultSemiBold" style={{ fontSize: 16 }}>{chatUser?.real_name || chatUser?.username}</ThemedText>
                                    <ThemedText style={{ fontSize: 11, opacity: 0.5 }}>
                                        {isMeeting
                                            ? 'Tap for info'
                                            : (userProfile?.is_online
                                                ? 'Active now'
                                                : userProfile?.last_online
                                                    ? `Last seen ${formatDistanceToNow(new Date(userProfile.last_online), { addSuffix: true })}`
                                                    : 'Offline')}
                                    </ThemedText>
                                </View>
                            </TouchableOpacity>
                        );
                    },
                    headerTitleAlign: 'left',
                    headerBackVisible: true,
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: theme.background }
                }}
            />

            <View style={{ flex: 1 }}>
                <FlatList
                    ref={flatListRef}
                    data={groupedMessages}
                    renderItem={({ item }) => {
                        if (item.type === 'date' && item.date) {
                            return (
                                <View style={styles.dateHeaderContainer}>
                                    <View style={[styles.dateHeader, { backgroundColor: theme.background }]}>
                                        <ThemedText style={[styles.dateHeaderText, { color: theme.icon + '80' }]}>
                                            {formatDateHeader(item.date)}
                                        </ThemedText>
                                    </View>
                                </View>
                            );
                        } else if (item.type === 'message' && item.message) {
                            return renderMessage({ item: item.message });
                        }
                        return null;
                    }}
                    keyExtractor={(item, index) => item.type === 'date' ? `date-${item.date}` : item.message?.id || `msg-${index}`}
                    inverted
                    contentContainerStyle={[styles.listContent, { paddingTop: 140 + keyboardPadding + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                />

                <Animated.View style={[
                    styles.inputContainer,
                    {
                        backgroundColor: theme.background,
                        paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 0 : 10),
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: theme.icon + '20',
                        position: 'absolute',
                        bottom: keyboardHeight,
                        left: 0,
                        right: 0,
                    }
                ]}>
                    <TouchableOpacity onPress={pickImage} style={styles.attachButton}>
                        <IconSymbol size={24} name="camera.fill" color={theme.icon} />
                    </TouchableOpacity>
                    <TextInput
                        style={[styles.input, { color: theme.text, backgroundColor: 'rgba(0,0,0,0.03)', borderColor: 'transparent' }]}
                        placeholder="Message..."
                        placeholderTextColor="#999"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity
                        onPress={() => setShowScheduleModal(true)}
                        style={styles.attachButton}
                        disabled={!inputText.trim()}
                    >
                        <IconSymbol size={24} name="clock.fill" color={inputText.trim() ? theme.tint : theme.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => sendMessage()}
                        disabled={sending || (!inputText.trim())}
                        style={[styles.sendButton, { opacity: sending || !inputText.trim() ? 0.3 : 1 }]}
                    >
                        {sending && !inputText.trim() ? (
                            <ActivityIndicator size="small" color={theme.tint} />
                        ) : (
                            <IconSymbol size={32} name="arrow.up.circle.fill" color={theme.tint} />
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Schedule Message Modal */}
            <Modal
                visible={showScheduleModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowScheduleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText type="subtitle" style={{ marginBottom: 15 }}>Schedule Message</ThemedText>
                        <ThemedText style={{ marginBottom: 20, opacity: 0.7 }}>Pick a date and time to send this message</ThemedText>

                        <View style={{ marginBottom: 20 }}>
                            <ThemedText style={{ fontSize: 16, marginBottom: 10, fontWeight: '600' }}>Selected Time:</ThemedText>
                            <ThemedText style={{ fontSize: 15, color: theme.tint }}>
                                {scheduleDate.toLocaleString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                            </ThemedText>
                        </View>

                        <View style={{ gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.presetBtn, { backgroundColor: theme.tint, marginBottom: 10 }]}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <IconSymbol name="calendar" size={20} color="white" />
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Pick Date & Time</ThemedText>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.icon + '20' }]}
                                onPress={() => setShowScheduleModal(false)}
                            >
                                <ThemedText>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                                onPress={() => {
                                    const now = new Date();
                                    if (scheduleDate <= now) {
                                        Alert.alert('Invalid Time', 'Please select a future time');
                                        return;
                                    }
                                    sendMessage(undefined, undefined, scheduleDate.toISOString());
                                    setShowScheduleModal(false);
                                }}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Schedule</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </ThemedView>
                </View>
            </Modal>

            {/* Native Date Picker */}
            {showDatePicker && (
                <DateTimePicker
                    value={scheduleDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {
                            setShowDatePicker(false);
                        }
                        if (selectedDate) {
                            setScheduleDate(selectedDate);
                            if (Platform.OS === 'android') {
                                // On Android, show time picker after date is selected
                                setTimeout(() => setShowTimePicker(true), 100);
                            } else {
                                // On iOS, show time picker immediately
                                setShowDatePicker(false);
                                setShowTimePicker(true);
                            }
                        }
                    }}
                />
            )}

            {/* Native Time Picker */}
            {showTimePicker && (
                <DateTimePicker
                    value={scheduleDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setShowTimePicker(false);
                        if (selectedDate) {
                            setScheduleDate(selectedDate);
                        }
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 15,
        paddingBottom: 20,
    },
    messageContainer: {
        marginBottom: 8,
        maxWidth: '85%',
    },
    myMessageContainer: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    theirMessageContainer: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },
    messageBubble: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    myBubbleRadius: {
        borderBottomRightRadius: 4,
    },
    theirBubbleRadius: {
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 2,
    },
    timestamp: {
        fontSize: 10,
    },
    messageImage: {
        width: 240,
        height: 240,
        borderRadius: 15,
        marginBottom: 8,
    },
    meetupContainer: {
        marginTop: 10,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        width: '100%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    meetupBtn: {
        flexDirection: 'row',
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 5,
    },
    meetupBubble: {
        borderTopLeftRadius: 5,
    },
    reactionContainer: {
        position: 'absolute',
        bottom: -10,
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    headerAvatarText: {
        color: 'white',
        fontSize: 15,
        fontWeight: 'bold',
    },
    headerActionBtn: {
        padding: 8,
        borderRadius: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
        alignItems: 'center',
        gap: 8,
    },
    input: {
        flex: 1,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 8,
        maxHeight: 120,
        fontSize: 16,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    attachButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
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
        maxWidth: 400,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
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
    presetBtn: {
        height: 50,
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
    },
    timeBtn: {
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
    },
    dateInput: {
        height: 50,
        width: '100%',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 15,
        fontSize: 16,
        textAlign: 'center',
    },
    dateHeaderContainer: {
        alignItems: 'center',
        marginVertical: 10,
        zIndex: 1,
    },
    dateHeader: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    dateHeaderText: {
        fontSize: 12,
        fontWeight: '600',
    },
});

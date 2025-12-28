import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TextInput, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import { addSocketListener } from '@/utils/socket';

type Message = {
    id: string;
    text: string;
    sender_id: string;
    timestamp: string;
    reactions?: Record<string, string>; // userId -> reaction char
    meetup_request?: {
        id: string;
        status: 'pending' | 'accepted' | 'declined';
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
    };
    messages: Message[];
    reactions: Reaction[];
};

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatUser, setChatUser] = useState<{ id: string, username: string } | null>(null);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const { user } = useAuth();



    const lastMessageTimestamp = useRef<string | undefined>(undefined);

    const fetchMessages = useCallback(async (after?: string) => {
        try {
            let url = `/v1/messages/${id}/get`;
            if (after) {
                url += `?after=${after}`;
            }
            const data: ChatData = await apiRequest(url);

            if (!after) {
                // Initial load
                setChatUser(data.user);
                setMessages(data.messages.reverse()); // Show newest at bottom
                if (data.messages.length > 0) {
                    lastMessageTimestamp.current = data.messages[0].timestamp;
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
                // Fetch new messages since last known timestamp
                fetchMessages(lastMessageTimestamp.current).then(() => markAsRead());
            }
        });

        return () => {
            removeListener();
        };
    }, [fetchMessages, id, markAsRead]);

    const sendMessage = async () => {
        if (!inputText.trim()) return;

        const textToSend = inputText;
        setInputText(''); // Optimistic clear
        setSending(true);

        try {
            const response = await apiRequest(`/v1/messages/${id}/send`, {
                method: 'POST',
                body: JSON.stringify({
                    text: textToSend,
                    timestamp: new Date().toISOString(),
                }),
            });

            // Optimistically add message
            const newMessage: Message = {
                id: response.message_id,
                text: textToSend,
                sender_id: user!.id,
                timestamp: response.timestamp,
            };

            setMessages(prev => [newMessage, ...prev]);
        } catch (error) {
            console.error('Failed to send message:', error);
            // Ideally show error toast and restore text
            setInputText(textToSend);
        } finally {
            setSending(false);
        }

    };

    const requestMeetup = async () => {
        Alert.alert(
            'Request Meetup',
            'Do you want to send a meetup request to this user? They will be able to see your exact location if they accept.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Request',
                    onPress: async () => {
                        try {
                            const response = await apiRequest(`/v1/messages/${id}/send`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    text: '📍 I sent a meetup request!',
                                    meetup: true,
                                    timestamp: new Date().toISOString(),
                                }),
                            });
                            // Optimistically add
                            const newMessage: Message = {
                                id: response.message_id,
                                text: '📍 I sent a meetup request!',
                                sender_id: user!.id,
                                timestamp: response.timestamp,
                                meetup_request: {
                                    id: 'temp', // This will be updated on refresh
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
    };

    const acceptMeetup = async (messageId: string, requestId: string) => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required to accept a meetup.');
                return;
            }

            setLoading(true);
            const location = await Location.getCurrentPositionAsync({});

            await apiRequest(`/v1/messages/${id}/meetup`, {
                method: 'POST',
                body: JSON.stringify({
                    location: {
                        lat: location.coords.latitude,
                        long: location.coords.longitude,
                        alt: location.coords.altitude
                    },
                    timestamp: new Date().toISOString(),
                    meta: { meetup_request_id: requestId }
                })
            });

            Alert.alert('Success', 'Meetup accepted! Location sent.');
            fetchMessages(); // Refresh to show updated status
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to accept meetup');
        } finally {
            setLoading(false);
        }
    };

    const handleDoubleTap = async (messageId: string) => {
        // Simple "Heart" reaction
        try {
            const reaction = '❤️';
            // Optimistic update (complex with Map, so maybe just API call and fetch)
            // Or simple local toggle
            // For now, fire and forget API
            await apiRequest(`/v1/messages/${id}/react`, {
                method: 'POST',
                body: JSON.stringify({ message_id: messageId, reaction })
            });
            // Re-fetch to see it
            fetchMessages();
        } catch (e) {
            console.log('Reaction failed', e);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sender_id === user?.id;
        let lastTap = 0;

        const handlePress = () => {
            const now = Date.now();
            const DOUBLE_PRESS_DELAY = 500;
            if (now - lastTap < DOUBLE_PRESS_DELAY) {
                handleDoubleTap(item.id);
            }
            lastTap = now;
        };

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
                    isMe ? { backgroundColor: theme.tint } : { backgroundColor: theme.icon },
                    item.meetup_request ? styles.meetupBubble : {}
                ]}>
                    <ThemedText style={[styles.messageText, isMe ? { color: 'white' } : { color: theme.background }]}>
                        {item.text}
                    </ThemedText>
                </View>

                {item.reactions && Object.keys(item.reactions).length > 0 && (
                    <View style={[styles.reactionContainer, isMe ? { right: 0 } : { left: 0 }]}>
                        <ThemedText style={{ fontSize: 12 }}>
                            {Object.values(item.reactions).join('')}
                        </ThemedText>
                    </View>
                )}

                <ThemedText style={styles.timestamp}>
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </ThemedText>

                {item.meetup_request && (
                    <View style={[styles.meetupContainer, { borderColor: theme.tint }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                            <IconSymbol name="location.circle" size={20} color={theme.text} />
                            <ThemedText type="defaultSemiBold">Meetup Request</ThemedText>
                        </View>
                        <ThemedText style={{ fontSize: 12, marginBottom: 10 }}>Status: {item.meetup_request.status.toUpperCase()}</ThemedText>

                        {item.meetup_request.status === 'pending' && !isMe && (
                            <TouchableOpacity
                                style={[styles.meetupBtn, { backgroundColor: theme.tint }]}
                                onPress={() => acceptMeetup(item.id, item.meetup_request!.id)}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Accept & Share Location</ThemedText>
                            </TouchableOpacity>
                        )}

                        {item.meetup_request.status === 'accepted' && (
                            <ThemedText style={{ color: 'green', marginTop: 5, fontWeight: 'bold' }}>📍 Location Shared</ThemedText>
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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <Stack.Screen
                options={{
                    title: chatUser?.username || 'Chat',
                    headerRight: () => (
                        <TouchableOpacity onPress={requestMeetup} style={{ marginRight: 10 }}>
                            <IconSymbol name="location.circle" size={24} color={theme.tint} />
                        </TouchableOpacity>
                    )
                }}
            />

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                inverted
                contentContainerStyle={styles.listContent}
            />

            <View style={[styles.inputContainer, { borderTopColor: theme.icon }]}>
                <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                    placeholder="Type a message..."
                    placeholderTextColor="#888"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                />
                <TouchableOpacity
                    onPress={sendMessage}
                    disabled={sending || !inputText.trim()}
                    style={[styles.sendButton, { opacity: !inputText.trim() ? 0.5 : 1 }]}
                >
                    <IconSymbol size={28} name="arrow.up.circle.fill" color={theme.tint} />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 15,
    },
    messageContainer: {
        marginBottom: 15,
        maxWidth: '80%',
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
        padding: 12,
        borderRadius: 20,
        marginBottom: 5,
    },
    messageText: {
        fontSize: 16,
    },
    timestamp: {
        fontSize: 10,
        opacity: 0.6,
        marginHorizontal: 5,
    },
    meetupContainer: {
        marginTop: 5,
        padding: 10,
        backgroundColor: '#eee',
        borderRadius: 10
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        maxHeight: 100,
        marginRight: 10,
        fontSize: 16,
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    meetupBtn: {
        marginTop: 10,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    meetupBubble: {
        borderTopLeftRadius: 5,
    },
    reactionContainer: {
        position: 'absolute',
        bottom: -10,
        backgroundColor: 'white',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2
    }
});

import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TextInput, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { IconSymbol } from '@/components/ui/icon-symbol';

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

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sender_id === user?.id;

        return (
            <View style={[
                styles.messageContainer,
                isMe ? styles.myMessageContainer : styles.theirMessageContainer
            ]}>
                <View style={[
                    styles.messageBubble,
                    isMe ? { backgroundColor: theme.tint } : { backgroundColor: theme.icon }
                ]}>
                    <ThemedText style={[styles.messageText, isMe ? { color: 'white' } : { color: theme.background }]}>
                        {item.text}
                    </ThemedText>
                </View>
                <ThemedText style={styles.timestamp}>
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </ThemedText>

                {item.meetup_request && (
                    <View style={styles.meetupContainer}>
                        <ThemedText>Meetup Request: {item.meetup_request.status}</ThemedText>
                        {/* Add actions here */}
                    </View>
                )}
            </View>
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
            <Stack.Screen options={{ title: chatUser?.username || 'Chat' }} />

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
});

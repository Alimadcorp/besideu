import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TextInput, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

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
    const { id } = useLocalSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatUser, setChatUser] = useState<ChatData['user'] | null>(null);
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
                fetchMessages(lastMessageTimestamp.current).then(() => markAsRead());
            }
        });

        return () => {
            removeListener();
        };
    }, [fetchMessages, id, markAsRead]);

    const sendMessage = async (textOverride?: string, imageUrl?: string) => {
        const textToSend = textOverride !== undefined ? textOverride : inputText;
        if (!textToSend.trim() && !imageUrl) return;

        if (textOverride === undefined) setInputText('');
        setSending(true);

        try {
            const response = await apiRequest(`/v1/messages/${id}/send`, {
                method: 'POST',
                body: JSON.stringify({
                    text: textToSend,
                    image_url: imageUrl,
                    timestamp: new Date().toISOString(),
                }),
            });

            const newMessage: Message = {
                id: response.message_id,
                text: textToSend,
                image_url: imageUrl,
                sender_id: user!.id,
                timestamp: response.timestamp,
            };

            setMessages(prev => [newMessage, ...prev]);
        } catch (error) {
            console.error('Failed to send message:', error);
            if (textOverride === undefined) setInputText(textToSend);
            Alert.alert('Error', 'Failed to send message');
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

    const requestMeetup = async () => {
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
    };

    const acceptMeetup = async (messageId: string, requestId: string) => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required.');
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

            Alert.alert('Success', 'Meetup accepted!');
            fetchMessages();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to accept meetup');
        } finally {
            setLoading(false);
        }
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
                    isMe ? { backgroundColor: theme.tint } : { backgroundColor: 'rgba(0,0,0,0.05)' },
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
                        <ThemedText style={[styles.messageText, isMe ? { color: 'white' } : { color: theme.text }]}>
                            {item.text}
                        </ThemedText>
                    ) : null}

                    <View style={styles.messageFooter}>
                        <ThemedText style={[styles.timestamp, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: 'rgba(0,0,0,0.4)' }]}>
                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: false })}
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
                            Status: <ThemedText type="defaultSemiBold" style={{ textTransform: 'uppercase', fontSize: 12 }}>{item.meetup_request.status}</ThemedText>
                        </ThemedText>

                        {item.meetup_request.status === 'pending' && !isMe && (
                            <TouchableOpacity
                                style={[styles.meetupBtn, { backgroundColor: theme.tint }]}
                                onPress={() => acceptMeetup(item.id, item.meetup_request!.id)}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Accept & Share Location</ThemedText>
                            </TouchableOpacity>
                        )}

                        {item.meetup_request.status === 'accepted' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <IconSymbol name="checkmark.circle.fill" size={16} color="#34C759" />
                                <ThemedText style={{ color: '#34C759', fontWeight: 'bold' }}>Location Shared</ThemedText>
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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[styles.headerAvatar, { backgroundColor: theme.tint }]}>
                                {chatUser?.avatar_url ? (
                                    <Image source={{ uri: chatUser.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                ) : (
                                    <ThemedText style={styles.headerAvatarText}>{chatUser?.username.charAt(0).toUpperCase()}</ThemedText>
                                )}
                            </View>
                            <View>
                                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{chatUser?.real_name || chatUser?.username}</ThemedText>
                                <ThemedText style={{ fontSize: 11, opacity: 0.5 }}>online</ThemedText>
                            </View>
                        </View>
                    ),
                    headerRight: () => (
                        <TouchableOpacity onPress={requestMeetup} style={styles.headerActionBtn}>
                            <IconSymbol name="location.circle.fill" size={24} color={theme.tint} />
                        </TouchableOpacity>
                    ),
                    headerTitleAlign: 'left',
                    headerBackVisible: true,
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: theme.background }
                }}
            />

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                inverted
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <View style={[styles.inputContainer, { borderTopColor: 'rgba(0,0,0,0.05)', backgroundColor: theme.background }]}>
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
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 2,
        overflow: 'hidden',
    },
    myBubbleRadius: {
        borderBottomRightRadius: 4,
    },
    theirBubbleRadius: {
        borderBottomLeftRadius: 4,
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    messageImage: {
        width: 240,
        height: 240,
        borderRadius: 12,
        marginBottom: 8,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    timestamp: {
        fontSize: 10,
        opacity: 0.5,
    },
    meetupContainer: {
        marginTop: 8,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    attachButton: {
        marginRight: 10,
        padding: 5,
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
    },
    headerAvatarText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    headerAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    headerActionBtn: {
        marginRight: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

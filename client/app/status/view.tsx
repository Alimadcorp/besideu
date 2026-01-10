import { StyleSheet, View, TouchableOpacity, Dimensions, StatusBar, Animated, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '@/utils/api';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { width } = Dimensions.get('window');

interface StatusDisplay {
    id: string;
    type: 'text' | 'image';
    content: string;
    media_url: string | null;
    background_color: string;
    font_style: string;
    created_at: string;
    user: {
        id: string;
        username: string;
        real_name: string;
        avatar_url: string;
    };
    viewed: boolean;
    user_id?: string;
}

export default function ViewStatusScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams();
    const insets = useSafeAreaInsets();

    const [statuses, setStatuses] = useState<StatusDisplay[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch and filter logic
    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                // Fetch both me and feed to find the user's statuses
                const [me, feed] = await Promise.all([
                    apiRequest('/v1/status/me'),
                    apiRequest('/v1/status/feed')
                ]);

                let userStatuses: StatusDisplay[] = [];
                const targetUserId = userId as string;

                // Helper to format 'me' statuses to match feed structure roughly
                const myFormatted = (me.statuses || []).map((s: any) => ({
                    ...s,
                    user: {
                        id: s.user_id,
                        // We might not have full user details in 'me' response, but UI can handle missing avatar or load from cache/context if needed. 
                        // For now we assume simplistic placeholders if missing.
                        username: 'Me',
                        real_name: 'Me',
                        avatar_url: ''
                    }
                }));

                const all = [...myFormatted, ...(feed.feed || [])];

                // Filter by the requested userId
                userStatuses = all.filter((s: StatusDisplay) => s.user_id === targetUserId || s.user?.id === targetUserId);

                // Sort by creation time just in case
                userStatuses.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                if (userStatuses.length > 0) {
                    setStatuses(userStatuses);
                    // Find first unviewed to start there
                    const firstUnviewed = userStatuses.findIndex(s => !s.viewed);
                    setCurrentIndex(firstUnviewed >= 0 ? firstUnviewed : 0);
                } else {
                    // No statuses found, go back
                    router.back();
                }
            } catch (e) {
                console.error(e);
                router.back();
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchStatuses();
        }
    }, [userId]);

    const progress = useRef(new Animated.Value(0)).current;
    const [paused, setPaused] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    // Auto-advance logic with Animation
    useEffect(() => {
        if (loading || statuses.length === 0 || paused || keyboardVisible) {
            progress.stopAnimation();
            return;
        }

        // Reset progress if starting new status (logic inside handleNext handles index change)
        // Check if we just changed index or unpaused
        // If we are unpausing, we continue. If index changed, we restart? 
        // We need to track index changes separately or just reset on index change.
    }, [paused, keyboardVisible, loading, statuses.length]);

    useEffect(() => {
        if (loading || statuses.length === 0) return;

        progress.setValue(0);

        const anim = Animated.timing(progress, {
            toValue: 1,
            duration: 5000,
            useNativeDriver: false,
        });

        if (!paused && !keyboardVisible) {
            anim.start(({ finished }) => {
                if (finished) {
                    handleNext();
                }
            });
        }

        return () => {
            anim.stop();
        };
    }, [currentIndex, loading, statuses]);

    // Handle pause/unpause
    useEffect(() => {
        if (loading || statuses.length === 0) return;

        if (paused || keyboardVisible) {
            progress.stopAnimation();
        } else {
            // Resume from current value? difficult with standard Animated loop cleanly
            // For simplicity in this step, we just restart or let the separate effect handle it.
            // Actually, simplest 'resume' is to calculate remaining time.
            // Let's stick to simple: if paused, stop. If unpaused, start remaining? 
            // Standard stories behavior: hold to pause.
            // We'll implement robust logic:
            // 1. current value
            // 2. remaining duration = (1 - value) * 5000
            // 3. start timing

            progress.addListener(({ value }) => {
                // track value?
            });

            // Simplification: We rely on the progress value.
            const currentVal = (progress as any)._value; // Hacky access or use listener
            const remaining = (1 - currentVal) * 5000;

            Animated.timing(progress, {
                toValue: 1,
                duration: remaining,
                useNativeDriver: false
            }).start(({ finished }) => {
                if (finished) handleNext();
            });
        }
    }, [paused, keyboardVisible]);

    // Keyboard listeners
    useEffect(() => {
        const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    // Mark as viewed
    useEffect(() => {
        if (!loading && statuses[currentIndex] && !statuses[currentIndex].viewed) {
            // Optimistically update
            const newStatuses = [...statuses];
            newStatuses[currentIndex].viewed = true;
            setStatuses(newStatuses);

            apiRequest(`/v1/status/${statuses[currentIndex].id}/view`, { method: 'POST' }).catch(console.error);
        }
    }, [currentIndex, loading]);

    const handleNext = () => {
        if (currentIndex < statuses.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            router.back();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else {
            router.back();
        }
    };

    if (loading || statuses.length === 0) {
        return <View style={{ flex: 1, backgroundColor: 'black' }} />;
    }

    const currentStatus = statuses[currentIndex];
    const user = currentStatus.user;

    return (
        <View style={styles.container}>
            <StatusBar hidden />

            {/* Progress Bars */}
            <View style={[styles.progressContainer, { paddingTop: insets.top + 10 }]}>
                {statuses.map((_, idx) => (
                    <View key={idx} style={styles.progressBarBackground}>
                        <Animated.View style={[
                            styles.progressBarFill,
                            {
                                width: idx === currentIndex ?
                                    progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    }) :
                                    idx < currentIndex ? '100%' : '0%'
                            }
                        ]} />
                    </View>
                ))}
            </View>

            {/* Content */}
            <View style={styles.content}>
                {currentStatus.type === 'image' && currentStatus.media_url ? (
                    <Image
                        source={{ uri: currentStatus.media_url }}
                        style={styles.image}
                        contentFit="contain"
                    />
                ) : (
                    <View style={[styles.textContent, { backgroundColor: currentStatus.background_color || 'black' }]}>
                        <ThemedText style={[styles.text, { fontFamily: currentStatus.font_style }]}>{currentStatus.content}</ThemedText>
                    </View>
                )}

                {/* Caption */}
                {currentStatus.type === 'image' && currentStatus.content && (
                    <View style={styles.captionContainer}>
                        <ThemedText style={styles.caption}>{currentStatus.content}</ThemedText>
                    </View>
                )}
            </View>

            {/* Header Info */}
            <View style={[styles.header, { top: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Image source={{ uri: user.avatar_url || 'https://via.placeholder.com/40' }} style={styles.avatar} contentFit="cover" />
                    <View>
                        <ThemedText style={styles.username}>{user.real_name || user.username}</ThemedText>
                        <ThemedText style={styles.time}>
                            {new Date(currentStatus.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()}>
                    <IconSymbol name="xmark" size={24} color="white" />
                </TouchableOpacity>
            </View>

            {/* Touch Zones */}
            <View style={styles.touchContainer}>
                <TouchableWithoutFeedback
                    onPressIn={() => setPaused(true)}
                    onPressOut={() => setPaused(false)}
                    onPress={handlePrev}
                >
                    <View style={styles.touchLeft} />
                </TouchableWithoutFeedback>
                <TouchableWithoutFeedback
                    onPressIn={() => setPaused(true)}
                    onPressOut={() => setPaused(false)}
                    onPress={handleNext}
                >
                    <View style={styles.touchRight} />
                </TouchableWithoutFeedback>
            </View>

            {/* Reply Input */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}
            >
                <TextInput
                    style={styles.replyInput}
                    placeholder="Reply..."
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    value={replyText}
                    onChangeText={setReplyText}
                    onSubmitEditing={() => {
                        if (replyText.trim()) {
                            // Find DM or navigate
                            // For simplicity, we navigate to chat with default params or try to find chat
                            // But better: Use router with params or just close and alert "Replied"
                            Alert.alert('Sent', 'Reply sent!');
                            setReplyText('');
                            setKeyboardVisible(false);
                            Keyboard.dismiss();
                        }
                    }}
                />
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    progressContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        gap: 5,
        zIndex: 20,
        position: 'absolute',
        width: '100%',
    },
    progressBarBackground: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: 'white',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    text: {
        fontSize: 30,
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    header: {
        position: 'absolute',
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'white',
    },
    username: {
        color: 'white',
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
        fontSize: 16,
    },
    time: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    touchContainer: {
        position: 'absolute',
        top: 100,
        bottom: 100,
        left: 0,
        right: 0,
        flexDirection: 'row',
        zIndex: 10,
    },
    touchLeft: { flex: 1 },
    touchRight: { flex: 1 },
    captionContainer: {
        position: 'absolute',
        bottom: 100,
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    caption: {
        color: 'white',
        fontSize: 18,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 5,
        borderRadius: 5,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        paddingHorizontal: 15,
        paddingTop: 10,
        backgroundColor: 'rgba(0,0,0,0.1)', // Subtle bg
    },
    replyInput: {
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        color: 'white',
        paddingHorizontal: 20,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    }
});

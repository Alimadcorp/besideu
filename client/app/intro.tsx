import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

const { width, height } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const SLIDES = [
    {
        key: 'one',
        title: 'Discover Nearby',
        text: 'BesideU helps you find friends and interesting people right where you are.',
        icon: 'location-outline',
        color: '#007AFF',
    },
    {
        key: 'two',
        title: 'Real-Time Radar',
        text: 'Watch your circle move in real-time. Connect with friends within 3km instantly.',
        icon: 'navigate-outline',
        color: '#34C759',
    },
    {
        key: 'three',
        title: 'Instant Meetups',
        text: 'See someone nearby? Send a request to share live locations and meet up.',
        icon: 'people-outline',
        color: '#FF9500',
    },
    {
        key: 'four',
        title: 'Safe & Secure',
        text: 'Your privacy is built-in. Control exactly who sees you and when.',
        icon: 'shield-checkmark-outline',
        color: '#5856D6',
    },
];

export default function IntroScreen() {
    const router = useRouter();
    const { setHasSeenIntro, user } = useAuth();
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    // Animation Values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        fadeAnim.setValue(0);
        slideAnim.setValue(30);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            })
        ]).start();
    }, [activeIndex]);

    const handleNext = async () => {
        if (activeIndex === SLIDES.length - 1) {
            setHasSeenIntro();
        } else {
            // Use the ref from the ScrollView
            (scrollRef.current as any)?.scrollTo({ x: width * (activeIndex + 1), animated: true });
        }
    };

    const bgColor = scrollX.interpolate({
        inputRange: SLIDES.map((_, i) => i * width),
        outputRange: SLIDES.map(s => s.color + '15'),
    });

    const activeColor = scrollX.interpolate({
        inputRange: SLIDES.map((_, i) => i * width),
        outputRange: SLIDES.map(s => s.color),
    });

    return (
        <Animated.View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: bgColor }]}>
            {/* Background Decor */}
            <View style={[styles.circleDecor, { backgroundColor: theme.tint, opacity: 0.1, top: -100, right: -100 }]} />
            <View style={[styles.circleDecor, { backgroundColor: theme.tint, opacity: 0.05, bottom: -50, left: -50, width: 220, height: 220, borderRadius: 110 }]} />

            {/* Profile Header */}
            {user && (
                <Animated.View style={[styles.userHeader, { opacity: fadeAnim }]}>
                    <Image
                        source={{ uri: user.avatar_url || 'https://via.placeholder.com/150' }}
                        style={styles.userAvatar}
                    />
                    <View>
                        <ThemedText style={styles.welcomeText}>Welcome back,</ThemedText>
                        <ThemedText type="defaultSemiBold" style={styles.userNameText}>{user.real_name || user.username}</ThemedText>
                    </View>
                </Animated.View>
            )}

            <Animated.ScrollView
                ref={scrollRef as any}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    {
                        useNativeDriver: false, // backgroundColor interpolation needs false for some properties, but we'll try it
                        listener: (event: any) => {
                            const slide = Math.round(event.nativeEvent.contentOffset.x / width);
                            if (slide !== activeIndex) {
                                setActiveIndex(slide);
                            }
                        }
                    }
                )}
                scrollEventThrottle={16}
                style={{ flex: 1 }}
            >
                {SLIDES.map((slide, index) => (
                    <View key={slide.key} style={styles.slide}>
                        <Animated.View style={{
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                            alignItems: 'center',
                            width: '100%'
                        }}>
                            <View style={[styles.iconContainer, { backgroundColor: slide.color + '20', shadowColor: slide.color }]}>
                                <Ionicons name={slide.icon as any} size={80} color={slide.color} />
                            </View>
                            <ThemedText type="title" style={[styles.title, { color: slide.color }]}>{slide.title}</ThemedText>
                            <ThemedText style={styles.text}>{slide.text}</ThemedText>
                        </Animated.View>
                    </View>
                ))}
            </Animated.ScrollView>

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {SLIDES.map((_, i) => {
                        const dotWidth = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [8, 24, 8],
                            extrapolate: 'clamp',
                        });
                        const opacity = scrollX.interpolate({
                            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: 'clamp',
                        });

                        return (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.paginationDot,
                                    {
                                        backgroundColor: activeColor,
                                        width: dotWidth,
                                        opacity
                                    }
                                ]}
                            />
                        );
                    })}
                </View>

                <Animated.View style={{ width: '100%', alignItems: 'center' }}>
                    <AnimatedTouchableOpacity
                        style={[styles.button, { backgroundColor: activeColor, shadowColor: theme.tint }]}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <ThemedText style={styles.buttonText}>
                            {activeIndex === SLIDES.length - 1 ? "Get Started" : 'Next'}
                        </ThemedText>
                        {activeIndex !== SLIDES.length - 1 && <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />}
                    </AnimatedTouchableOpacity>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    slide: {
        width,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        width: 160,
        height: 160,
        borderRadius: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        textAlign: 'center',
        marginBottom: 16,
        fontSize: 32,
        fontWeight: 'bold',
    },
    text: {
        textAlign: 'center',
        fontSize: 18,
        lineHeight: 28,
        opacity: 0.7,
        maxWidth: '90%',
    },
    footer: {
        height: 150,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 40,
    },
    pagination: {
        flexDirection: 'row',
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paginationDot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    button: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 30,
        minWidth: 220,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    circleDecor: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        zIndex: -1,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingVertical: 20,
        gap: 15,
        alignSelf: 'flex-start',
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'white',
    },
    welcomeText: {
        fontSize: 14,
        opacity: 0.6,
    },
    userNameText: {
        fontSize: 16,
    }
});

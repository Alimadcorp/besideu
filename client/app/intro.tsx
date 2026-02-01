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

const SLIDES = [
    {
        key: 'one',
        title: 'Discover Who is Beside you',
        text: 'The world is full of connections waiting to happen. See who’s nearby and start your journey.',
        icon: 'planet-outline',
    },
    {
        key: 'two',
        title: 'Real-Time Nearby Radar',
        text: 'Find friends and interesting people within your instant range. No stalking, just connecting.',
        icon: 'radio-outline',
    },
    {
        key: 'three',
        title: 'Instant Meetups',
        text: 'See someone you know? Send a "Meetup Request" to share live locations for 1 hour.',
        icon: 'flash-outline',
    },
    {
        key: 'four',
        title: 'Private & Secure',
        text: 'Your location is yours. Share it only when you want, with whom you want.',
        icon: 'shield-checkmark-outline',
    },
];

export default function IntroScreen() {
    const router = useRouter();
    const { setHasSeenIntro, user } = useAuth();
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    // Animation Values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Reset and play animation on slide change
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
            scrollRef.current?.scrollTo({ x: width * (activeIndex + 1), animated: true });
        }
    };

    const onScroll = (event: any) => {
        const slide = Math.ceil(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
        if (slide !== activeIndex) {
            setActiveIndex(slide);
        }
    };

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Background Decor */}
            <View style={[styles.circleDecor, { backgroundColor: theme.tint, opacity: 0.1, top: -100, right: -100 }]} />
            <View style={[styles.circleDecor, { backgroundColor: theme.tint, opacity: 0.05, bottom: -50, left: -50, width: 200, height: 200, borderRadius: 100 }]} />

            {/* Profile Header (if logged in) */}
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

            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                style={{ flex: 1 }}
                contentContainerStyle={{ alignItems: 'center' }}
            >
                {SLIDES.map((slide, index) => (
                    <View key={slide.key} style={styles.slide}>
                        <Animated.View style={{
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                            alignItems: 'center',
                            width: '100%'
                        }}>
                            <View style={[styles.iconContainer, { backgroundColor: theme.tint + '15', shadowColor: theme.tint }]}>
                                <Ionicons name={slide.icon as any} size={80} color={theme.tint} />
                            </View>
                            <ThemedText type="title" style={styles.title}>{slide.title}</ThemedText>
                            <ThemedText style={styles.text}>{slide.text}</ThemedText>
                        </Animated.View>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {SLIDES.map((_, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.paginationDot,
                                {
                                    backgroundColor: i === activeIndex ? theme.tint : theme.icon + '40',
                                    width: i === activeIndex ? 20 : 8,
                                }
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.tint, shadowColor: theme.tint }]}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <ThemedText style={styles.buttonText}>
                        {activeIndex === SLIDES.length - 1 ? "Let's Go" : 'Next'}
                    </ThemedText>
                    {activeIndex !== SLIDES.length - 1 && <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
            </View>
        </ThemedView>
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

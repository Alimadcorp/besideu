import React, { useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Image } from 'react-native';
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
        title: 'Welcome to BesideU',
        text: 'Reconnecting you with the people around you.\n\nAn app by Habeebullah Arif Wattoo',
        icon: 'people-circle-outline',
    },
    {
        key: 'two',
        title: 'The Nearby Feature',
        text: 'See friends who are within your range.\nFind out who is beside you right now.',
        icon: 'location-outline',
    },
    {
        key: 'three',
        title: 'Private Chats',
        text: 'Securely chat with your friends.\nStay in touch anytime, anywhere.',
        icon: 'chatbubbles-outline',
    },
    {
        key: 'four',
        title: 'Meetups',
        text: 'Ready to meet? Send a meetup request to get their live location for an hour.',
        icon: 'map-outline',
    },
];

export default function IntroScreen() {
    const router = useRouter();
    const { setHasSeenIntro } = useAuth();
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const themeColors = Colors[colorScheme ?? 'light'];

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
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                className="flex-1"
            >
                {SLIDES.map((slide, index) => (
                    <View key={slide.key} style={styles.slide}>
                        <View style={styles.iconContainer}>
                            <Ionicons name={slide.icon as any} size={100} color={themeColors.tint} />
                        </View>
                        <View style={styles.textContainer}>
                            <ThemedText type="title" style={styles.title}>{slide.title}</ThemedText>
                            <ThemedText style={styles.text}>{slide.text}</ThemedText>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {SLIDES.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.paginationDot,
                                { backgroundColor: i === activeIndex ? themeColors.tint : '#ccc' },
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: themeColors.tint }]}
                    onPress={handleNext}
                >
                    <ThemedText style={styles.buttonText}>
                        {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                    </ThemedText>
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
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        marginBottom: 40,
        marginTop: -50,
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        marginBottom: 20,
        fontSize: 28,
    },
    text: {
        textAlign: 'center',
        fontSize: 16,
        lineHeight: 24,
        opacity: 0.8,
    },
    footer: {
        height: 120,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 20,
    },
    pagination: {
        flexDirection: 'row',
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paginationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginHorizontal: 8,
    },
    button: {
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 30,
        minWidth: 200,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

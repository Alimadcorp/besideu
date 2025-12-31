import React, { useEffect, useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { format } from 'date-fns';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { apiRequest } from '@/utils/api';

type Meeting = {
    id: string;
    title: string;
    description: string;
    location: any;
    starts_at: string;
    ends_at: string;
    role: 'creator' | 'invited';
    invitation_status?: string;
};

export default function MeetingsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchMeetings();
    }, []);

    async function fetchMeetings() {
        try {
            const data = await apiRequest('/v1/meetings/list');
            if (data.meetings) {
                setMeetings(data.meetings);
            }
        } catch (error) {
            console.error('Failed to fetch meetings', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const onRefresh = () => {
        setRefreshing(true);
        fetchMeetings();
    };

    const renderItem = ({ item }: { item: Meeting }) => {
        const startDate = new Date(item.starts_at);
        const isCreator = item.role === 'creator';

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.background, borderColor: theme.icon + '20' }]}
                onPress={() => router.push(`/meetings/${item.id}`)}
            >
                <View style={styles.header}>
                    <ThemedText type="defaultSemiBold" style={styles.title}>{item.title}</ThemedText>
                    {isCreator ? (
                        <View style={[styles.badge, { backgroundColor: theme.tint + '20' }]}>
                            <ThemedText style={[styles.badgeText, { color: theme.tint }]}>Host</ThemedText>
                        </View>
                    ) : (
                        <View style={[styles.badge, { backgroundColor: theme.icon + '20' }]}>
                            <ThemedText style={[styles.badgeText, { color: theme.icon }]}>{item.invitation_status || 'Guest'}</ThemedText>
                        </View>
                    )}
                </View>

                <View style={styles.details}>
                    <View style={styles.row}>
                        <IconSymbol size={16} name="calendar" color={theme.icon} />
                        <ThemedText style={styles.detailText}>
                            {format(startDate, 'MMM d, h:mm a')}
                        </ThemedText>
                    </View>
                    <View style={styles.row}>
                        <IconSymbol size={16} name="location.fill" color={theme.icon} />
                        <ThemedText style={styles.detailText} numberOfLines={1}>
                            {item.location?.name || 'No location set'}
                        </ThemedText>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Meetings',
                    headerRight: () => (
                        <TouchableOpacity onPress={() => router.push('/meetings/create')}>
                            <IconSymbol size={28} name="plus.circle.fill" color={theme.tint} />
                        </TouchableOpacity>
                    ),
                }}
            />

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.tint} />
                </View>
            ) : (
                <FlatList
                    data={meetings}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
                    }
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <ThemedText style={{ opacity: 0.6 }}>No upcoming meetings</ThemedText>
                        </View>
                    }
                />
            )}
        </ThemedView>
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
        padding: 20,
    },
    list: {
        padding: 16,
        gap: 12,
    },
    card: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 18,
        flex: 1,
        marginRight: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    details: {
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        opacity: 0.8,
    },
});

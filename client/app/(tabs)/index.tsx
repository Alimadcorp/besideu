import { StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, View } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppState } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import { Image } from 'expo-image';

type DM = {
  id: string;
  user_id: string;
  username: string;
  real_name?: string;
  avatar_url?: string;
  last_message: {
    text: string;
    timestamp: string;
  };
  unread_count: number;
  updated_at: string;
};

import { addSocketListener } from '@/utils/socket';

const formatChatTime = (ts: string) => {
  const date = new Date(ts);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return date.toLocaleDateString("en-GB");
};

export default function ChatsScreen() {
  const [dms, setDms] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const fetchChats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      //const data = await apiRequest('/v1/messages/list');
      //setDms(data.dms || []);
      setDms([{
        id: "www",
        type: 'dm',
        user_id: "wwww",
        username: "kela",
        real_name: "kola",
        avatar_url: "https://www.otherUser.avatar_url",
        last_message: {
          text: '',
          timestamp: 0,
        },
        unread_count: 0,
        updated_at: 0
      }] as any);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (!user) return;

    fetchChats();

    const removeListener = addSocketListener((msg) => {
      if (msg.type === 'new_message') {
        // efficient: could just update the specific item if payload allows, 
        // but refreshing list is safer for now to update order and unread count
        fetchChats();
      }
    });

    // Refresh on app state change (when app comes to foreground)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchChats();
      }
    });

    return () => {
      removeListener();
      subscription.remove();
    };
  }, [fetchChats, user]);

  const renderItem = ({ item }: { item: DM }) => (
    <TouchableOpacity
      style={[styles.chatItem, { borderBottomColor: theme.icon + '20' }]}
      onPress={() => router.push(`/chats/${item.id}` as any)}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: (item as any).type === 'meeting' ? theme.text : theme.tint, overflow: 'hidden' }]}>
          {(item as any).type === 'meeting' ? (
            <IconSymbol name="person.3.fill" size={24} color={theme.background} />
          ) : item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <ThemedText style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</ThemedText>
          )}
        </View>
        {item.unread_count > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: '#FF3B30' }]} />
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <ThemedText
            numberOfLines={1}
            ellipsizeMode="tail"
            type="defaultSemiBold"
            style={styles.username}
          >
            {item.real_name || item.username}
          </ThemedText>

          <ThemedText numberOfLines={1} style={styles.timestamp}>
            {item.last_message?.timestamp
              ? formatChatTime(item.last_message.timestamp)
              : ""}
          </ThemedText>
        </View>

        <View style={styles.messagePreview}>
          <ThemedText numberOfLines={1} style={[styles.messageText, item.unread_count > 0 && styles.unreadMessage]}>
            {item.last_message?.text || 'No messages yet'}
          </ThemedText>
          {item.unread_count > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.tint }]}>
              <ThemedText style={styles.badgeText}>{item.unread_count}</ThemedText>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <ThemedText type="title">Chats</ThemedText>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={dms}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.tint + '15' }]}>
                <IconSymbol name="bubble.left.and.bubble.right.fill" size={40} color={theme.tint} />
              </View>
              <ThemedText style={styles.emptyTitle}>Your inbox is empty</ThemedText>
              <ThemedText style={styles.emptySubtext}>Find your friends and start a conversation!</ThemedText>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.tint }]}
                onPress={() => router.push('/contacts')}
              >
                <ThemedText style={styles.primaryButtonText}>Find Friends</ThemedText>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={[
            dms.length === 0 && styles.emptyList,
            { paddingBottom: insets.bottom + 80 }
          ]}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarContainer: {
    marginRight: 15,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  username: {
    width: "75%",
    fontSize: 16,
  },
  timestamp: {
    width: "25%",
    textAlign: "right",
    opacity: 0.6,
    fontSize: 12,
  },
  messagePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageText: {
    flex: 1,
    opacity: 0.7,
    fontSize: 14,
  },
  unreadMessage: {
    fontWeight: 'bold',
    opacity: 1,
  },
  badge: {
    backgroundColor: '#007AFF', // Or theme.tint
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    opacity: 0.5,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  primaryButton: {
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyList: {
    flexGrow: 1,
  }
});

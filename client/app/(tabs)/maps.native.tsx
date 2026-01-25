import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { hashLocationAll } from '@/utils/crypto';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { LOCATION_TASK_NAME } from '@/utils/background-location';
import { useRouter } from 'expo-router';

type NearbyUser = {
  id: string;
  username: string;
  real_name?: string;
  avatar_url?: string;
  distance: string; // 'beside_you' | 'very_near' | 'near' | 'far' | 'very_far'
  is_online?: boolean;
  last_online?: string;
  location_shared_at?: string;
  is_business?: boolean;
  is_friend?: boolean;
};

export default function NearbyScreen() {
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [status, setStatus] = useState<'idle' | 'getting_location' | 'updating_location' | 'fetching_users' | 'ready'>('idle');

  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const fetchNearbyUsers = useCallback(async () => {
    try {
      setStatus('getting_location');
      const location = await Location.getCurrentPositionAsync({});
      const hashes = hashLocationAll(location.coords.latitude, location.coords.longitude);

      setStatus('updating_location');
      // Update our location first with 3km hash only
      await apiRequest('/v1/location/set', {
        method: 'PUT',
        body: JSON.stringify({
          location_hash_3km: hashes.location_hash_3km,
          timestamp: new Date().toISOString(),
        }),
      });

      setStatus('fetching_users');
      // Find nearby (only 3km range)
      const data = await apiRequest('/v1/location/find');
      setNearbyUsers(data.users);
      setStatus('ready');
    } catch (error) {
      console.error('Failed to fetch nearby users:', error);
      Alert.alert('Error', 'Could not fetch nearby users.');
      setStatus('ready');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const requestPermissions = async () => {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      Alert.alert('Permission to access location was denied');
      return;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      Alert.alert('Permission to access background location was denied');
      // We can still proceed with foreground features
    }

    setLocationPermission(foregroundStatus);
    fetchNearbyUsers();

    // Start background task if granted
    if (backgroundStatus === 'granted') {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000, // 1 minute
          distanceInterval: 100, // 100 meters
          foregroundService: {
            notificationTitle: "BesideU is running",
            notificationBody: "Updating your location to find nearby friends.",
          },
        });
      }
    }
  };

  useEffect(() => {
    requestPermissions();
  }, [fetchNearbyUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNearbyUsers();
  }, [fetchNearbyUsers]);

  const sendFriendRequest = async (userId: string) => {
    try {
      await apiRequest(`/v1/friends/add?user=${userId}`, { method: 'POST' });
      Alert.alert('Success', 'Friend request sent!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send friend request');
    }
  };

  const renderItem = ({ item }: { item: NearbyUser }) => (
    <View style={[styles.userItem, { borderBottomColor: theme.icon }]}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: theme.tint, overflow: 'hidden' }]}>
          {item.avatar_url ? (
            <Image
              source={{ uri: item.avatar_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <ThemedText style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</ThemedText>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.userInfo} onPress={() => router.push(`/user/${item.id}` as any)}>
        <ThemedText type="defaultSemiBold" style={styles.username}>
          {item.real_name || item.username}
        </ThemedText>
        {item.location_shared_at && (
          <ThemedText numberOfLines={1} style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
            Updated {formatDistanceToNow(new Date(item.location_shared_at), { addSuffix: true })}
          </ThemedText>
        )}
        <ThemedText style={styles.distance}>
          {item.distance === 'beside_you' ? 'Beside you' :
            item.distance === 'very_near' ? 'Very near' :
              item.distance === 'near' ? 'Near you' :
                item.distance === 'far' ? 'Far away' :
                  'Very far'}
        </ThemedText>
      </TouchableOpacity>
      {item.is_business && !item.is_friend ? (
        // Business user, not a friend - show chat only
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.tint }]}
          onPress={async () => {
            try {
              const chatsData = await apiRequest('/v1/messages/list');
              const existingChat = chatsData.dms?.find((dm: any) => dm.user_id === item.id);
              if (existingChat) {
                router.push(`/chats/${existingChat.id}` as any);
              } else {
                router.push(`/user/${item.id}` as any);
              }
            } catch (e) {
              router.push(`/chats` as any);
            }
          }}
        >
          <IconSymbol name="message.fill" size={20} color="white" />
        </TouchableOpacity>
      ) : item.is_friend && ['beside_you', 'very_near', 'near', 'far', 'very_far'].includes(item.distance) ? (
        // Friend in range - show meetup option
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.tint }]}
          onPress={async () => {
            try {
              // Find existing DM
              const chatsData = await apiRequest('/v1/messages/list');
              const existingChat = chatsData.dms?.find((dm: any) => dm.user_id === item.id);

              if (existingChat) {
                router.push(`/chats/${existingChat.id}?meetup=true` as any);
              } else {
                router.push(`/user/${item.id}` as any);
              }
            } catch (e) {
              console.error('Failed to find chat', e);
              router.push(`/user/${item.id}` as any);
            }
          }}
        >
          <IconSymbol name="location.circle.fill" size={20} color="white" />
        </TouchableOpacity>
      ) : (
        // Friend not in range or other case - show chat
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.tint }]}
          onPress={async () => {
            try {
              const chatsData = await apiRequest('/v1/messages/list');
              const existingChat = chatsData.dms?.find((dm: any) => dm.user_id === item.id);
              if (existingChat) {
                router.push(`/chats/${existingChat.id}` as any);
              } else {
                router.push(`/user/${item.id}` as any);
              }
            } catch (e) {
              router.push(`/chats` as any);
            }
          }}
        >
          <IconSymbol name="message.fill" size={20} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <ThemedText type="title">Nearby</ThemedText>
      </View>

      {!locationPermission ? (
        <View style={styles.permissionContainer}>
          <ThemedText>Location permission needed to find nearby friends.</ThemedText>
          <TouchableOpacity onPress={requestPermissions} style={[styles.permissionButton, { backgroundColor: theme.tint }]}>
            <ThemedText style={{ color: 'white' }}>Grant Permission</ThemedText>
          </TouchableOpacity>
        </View>
      ) : loading || status !== 'ready' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} style={{ marginBottom: 10 }} />
          <ThemedText style={{ opacity: 0.7 }}>
            {status === 'getting_location' ? 'Getting your location...' :
             status === 'updating_location' ? 'Updating location...' :
             status === 'fetching_users' ? 'Finding nearby friends...' :
             'Loading...'}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={nearbyUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ThemedText style={{ fontSize: 18, marginBottom: 10 }}>Map is for Friends</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                No friends in range :(
              </ThemedText>
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: theme.tint, marginTop: 20 }]}
                onPress={() => router.push('/contacts' as any)}
              >
                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Find Friends from Contacts</ThemedText>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={[
            nearbyUsers.length === 0 && styles.emptyList,
            { paddingBottom: insets.bottom + 120 }
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
  userItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
  },
  distance: {
    fontSize: 14,
    opacity: 0.6,
  },
  actionButton: {
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptySubtext: {
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 10,
  },
  emptyList: {
    flexGrow: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  permissionButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  }
});

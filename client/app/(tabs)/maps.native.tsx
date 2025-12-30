import { useRef, useCallback } from 'react';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
// import geohash from 'ngeohash'; // Removed
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';
import { hashLocation } from '@/utils/crypto';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { LOCATION_TASK_NAME } from '@/utils/background-location';

type NearbyUser = {
  id: string;
  username: string;
  real_name?: string;
  avatar_url?: string;
  distance: string; // 'near' | 'far'
  location_hash: string;
};

export default function NearbyScreen() {
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);

  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const fetchNearbyUsers = useCallback(async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const hash = hashLocation(location.coords.latitude, location.coords.longitude);

      // Update our location first
      await apiRequest('/v1/location/set', {
        method: 'PUT',
        body: JSON.stringify({
          location_hash: hash,
          timestamp: new Date().toISOString(),
        }),
      });

      // Get user preference for range
      const profileData = await apiRequest('/v1/user/me');
      const preferredRange = profileData.user?.preferences?.range || 5;

      // Find nearby
      const data = await apiRequest(`/v1/location/find?range=${preferredRange}`);
      setNearbyUsers(data.users);
    } catch (error) {
      console.error('Failed to fetch nearby users:', error);
      Alert.alert('Error', 'Could not fetch nearby users.');
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
      <View style={styles.userInfo}>
        <ThemedText type="defaultSemiBold" style={styles.username}>
          {item.real_name || item.username}
        </ThemedText>
        {item.real_name && <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>@{item.username}</ThemedText>}
        <ThemedText style={styles.distance}>
          {item.distance === 'near' ? 'Near you' : 'Far away'}
        </ThemedText>
      </View>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: theme.tint }]}
        onPress={() => {
          // We need to find the DM ID or navigate to a screen that can handle it.
          // For now, we can redirect to the chat tab or a search.
          // Since they are friends, a DM likely exists or can be created.
          router.push('/chats' as any);
        }}
      >
        <IconSymbol name="message.fill" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Nearby</ThemedText>
      </View>

      {!locationPermission ? (
        <View style={styles.permissionContainer}>
          <ThemedText>Location permission needed to find nearby friends.</ThemedText>
          <TouchableOpacity onPress={requestPermissions} style={[styles.permissionButton, { backgroundColor: theme.tint }]}>
            <ThemedText style={{ color: 'white' }}>Grant Permission</ThemedText>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 20 }} />
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
                For privacy reasons, only friends are shown on the map.
              </ThemedText>
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: theme.tint, marginTop: 20 }]}
                onPress={() => router.push('/contacts' as any)}
              >
                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Find Friends from Contacts</ThemedText>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={nearbyUsers.length === 0 && styles.emptyList}
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
    paddingTop: 60,
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
  }
});

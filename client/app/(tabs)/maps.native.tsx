import React, { useState, useEffect } from "react";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { Image, StyleSheet, View } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { setLocation, getLocations } from "../utils/socket";

const fallbackRegion = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 80,
  longitudeDelta: 80
};

export default function Map() {
  const [region, setRegion] = useState(fallbackRegion);
  const [users, setUsers] = useState({}); // {userId: {currentPos, targetPos, progress}}

  const DURATION = 200;
  const easeInOut = (t: number) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;

  const userId = "user_" + Math.floor(Math.random()*1000);

  // Initialize own position
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;

      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });

      setUsers({
        [userId]: {
          currentPos: { latitude, longitude },
          targetPos: { latitude, longitude },
          progress: 1
        }
      });

      setLocation(userId, { latitude, longitude });
    })();
  }, []);

  const handlePress = (e: { nativeEvent: { coordinate: { latitude: any; longitude: any; }; }; }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    setUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        targetPos: { latitude, longitude },
        progress: 0
      }
    }));

    setLocation(userId, { latitude, longitude });
  };

  useEffect(() => {
    getLocations((locations: any[]) => {
      setUsers(prev => {
        const next = {...prev};
        locations.forEach((u: { userId: string | number; latitude: any; longitude: any; }) => {
          if (!next[u.userId]) {
            next[u.userId] = {
              currentPos: { latitude: u.latitude, longitude: u.longitude },
              targetPos: { latitude: u.latitude, longitude: u.longitude },
              progress: 1
            };
          } else {
            next[u.userId] = {
              ...next[u.userId],
              targetPos: { latitude: u.latitude, longitude: u.longitude },
              progress: 0
            };
          }
        });
        return next;
      });
    });
  }, []);

  // Animation loop
  useEffect(() => {
    let lastTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;

      setUsers(prev => {
        const next = {...prev};
        Object.keys(next).forEach(uid => {
          const u = next[uid];
          if (u.progress < 1) {
            const p = Math.min(u.progress + dt/DURATION, 1);
            u.progress = p;
            const t = easeInOut(p);
            const lerp = (a: number, b: number) => a + (b-a)*t;
            u.currentPos = {
              latitude: lerp(u.currentPos.latitude, u.targetPos.latitude),
              longitude: lerp(u.currentPos.longitude, u.targetPos.longitude)
            };
          }
        });
        return next;
      });

      requestAnimationFrame(tick);
    };

    tick();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <MapView style={styles.map} initialRegion={region} onPress={handlePress}>
        {Object.keys(users).map(uid => (
          <Marker key={uid} coordinate={users[uid].currentPos}>
            <View style={styles.pin}>
              <Image
                source={{ uri: "https://http.cat/400.jpg" }}
                style={styles.avatar}
              />
            </View>
          </Marker>
        ))}
      </MapView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#4fffff",
    justifyContent: "center",
    alignItems: "center"
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 20
  }
});

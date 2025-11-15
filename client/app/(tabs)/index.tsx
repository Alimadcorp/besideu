import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#ffffffff', dark: '#000000ff' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">BesideU</ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Connect over the Internet, Physically</ThemedText>
        <ThemedText>
          <ThemedText type='defaultSemiBold'>BesideU is a social app designed to bring friends closer, both online and in the real world.</ThemedText><br/>
          Through BesideU, you can chat, share statuses, and manage your friends, just like any other social app, but with a twist: the app gives you a sense of where your friends are nearby. It lets you know when friends are around so you can plan spontaneous meetups. With contacts-based requests, seamless friend management, and location-aware social interactions, BesideU makes it easy to stay connected and aware of the people who matter most.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 180,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});

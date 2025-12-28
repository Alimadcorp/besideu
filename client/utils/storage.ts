import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export async function setToken(token: string) {
    if (Platform.OS === 'web') {
        await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
}

export async function getToken() {
    if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(TOKEN_KEY);
    } else {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    }
}

export async function setUser(user: any) {
    const jsonValue = JSON.stringify(user);
    if (Platform.OS === 'web') {
        await AsyncStorage.setItem(USER_KEY, jsonValue);
    } else {
        await SecureStore.setItemAsync(USER_KEY, jsonValue);
    }
}

export async function getUser() {
    let user;
    if (Platform.OS === 'web') {
        user = await AsyncStorage.getItem(USER_KEY);
    } else {
        user = await SecureStore.getItemAsync(USER_KEY);
    }
    return user ? JSON.parse(user) : null;
}

export async function removeToken() {
    if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
    } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
    }
}

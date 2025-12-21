import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export async function setToken(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
    return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setUser(user: any) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser() {
    const user = await SecureStore.getItemAsync(USER_KEY);
    return user ? JSON.parse(user) : null;
}

export async function removeToken() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
}

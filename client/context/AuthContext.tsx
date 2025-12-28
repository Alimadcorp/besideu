import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, setToken, removeToken, getUser, setUser as storeUser } from '@/utils/storage';
import { apiRequest, setOnUnauthorizedCallback } from '@/utils/api';
import { router } from 'expo-router';
import { connectWebSocket, disconnectWebSocket } from '@/utils/socket';

type User = {
    id: string;
    phone: string;
    username: string;
};

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    signIn: (firebaseToken: string) => Promise<void>;
    signUp: (firebaseToken: string, username: string, realName: string) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    signIn: async () => { },
    signUp: async () => { },
    signOut: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
        setOnUnauthorizedCallback(() => {
            signOut();
        });
    }, []);

    async function checkAuth() {
        try {
            const token = await getToken();
            const userData = await getUser();
            if (token && userData) {
                setUser(userData);
                connectWebSocket();
            } else if (token) {
                // Token exists but no user data, try to fetch or Logout
                await removeToken();
            }
        } catch (e) {
            // Token invalid
        } finally {
            setIsLoading(false);
        }
    }

    async function signIn(firebaseToken: string) {
        try {
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ firebase_token: firebaseToken }),
                requiresAuth: false,
            });

            await setToken(data.token);
            await storeUser(data.user);
            setUser(data.user);
            connectWebSocket();
            // Navigation handled by RootLayout useEffect when user state changes
        } catch (error) {
            console.error('Sign in failed', error);
            throw error;
        }
    }

    async function signUp(firebaseToken: string, username: string, realName: string) {
        try {
            const data = await apiRequest('/auth/signup', {
                method: 'POST',
                body: JSON.stringify({
                    firebase_token: firebaseToken,
                    username,
                    real_name: realName,
                }),
                requiresAuth: false,
            });

            await setToken(data.token);
            await storeUser(data.user);
            setUser(data.user);
            connectWebSocket();
            // Navigation handled by RootLayout useEffect
        } catch (error) {
            console.error('Sign up failed', error);
            throw error;
        }
    }

    async function signOut() {
        try {
            await apiRequest('/v1/logout', { method: 'POST' });
        } catch (e) {
            console.log('Logout API failed', e);
        }
        await removeToken();
        disconnectWebSocket();
        setUser(null);
        router.replace('/auth/login');
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

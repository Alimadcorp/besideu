import { getToken, setToken, removeToken, setUser } from './storage';
import { auth } from './firebase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.besideu.alimad.co';

type RequestOptions = RequestInit & {
    requiresAuth?: boolean;
};

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(callback: () => void) {
    onUnauthorizedCallback = callback;
}

export async function apiRequest(endpoint: string, options: RequestOptions = {}) {
    const { requiresAuth = true, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);

    if (requiresAuth) {
        const token = await getToken();
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
    }

    if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    let response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    // Handle 401 Unauthorized
    if (response.status === 401 && requiresAuth) {
        console.log(`[API] 401 Unauthorized on ${endpoint}, attempting reauth...`);
        try {
            const fbUser = auth.currentUser;
            if (fbUser) {
                const idToken = await fbUser.getIdToken(true);
                const loginResponse = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ firebase_token: idToken }),
                });

                if (loginResponse.ok) {
                    const loginData = await loginResponse.json();
                    await setToken(loginData.token);
                    await setUser(loginData.user);

                    // Retry original request with new token
                    headers.set('Authorization', `Bearer ${loginData.token}`);
                    response = await fetch(`${API_URL}${endpoint}`, {
                        ...fetchOptions,
                        headers,
                    });
                } else {
                    throw new Error('Re-login failed');
                }
            } else {
                throw new Error('No firebase user found');
            }
        } catch (reauthError) {
            console.error('[API] Reauthorization failed:', reauthError);
            await removeToken();
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
            // Trigger a logout event or just throw
            throw new Error('Session expired. Please log in again.');
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText || 'API Request Failed');
    }

    return response.json();
}

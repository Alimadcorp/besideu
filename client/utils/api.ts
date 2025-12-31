import { getToken, setToken, removeToken, setUser } from './storage';
import { auth } from './firebase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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

        // Prevent infinite loops - don't retry auth endpoints
        if (endpoint.includes('/auth/')) {
            throw new Error('Authentication failed');
        }

        try {
            const fbUser = auth.currentUser;
            if (!fbUser) {
                throw new Error('No firebase user found');
            }

            // Force refresh the Firebase ID token
            const idToken = await fbUser.getIdToken(true);

            // Call the correct login endpoint
            const loginResponse = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firebase_token: idToken }),
            });

            if (!loginResponse.ok) {
                throw new Error('Re-login failed');
            }

            const loginData = await loginResponse.json();
            await setToken(loginData.token);
            await setUser(loginData.user);

            // Retry original request with new token
            headers.set('Authorization', `Bearer ${loginData.token}`);
            response = await fetch(`${API_URL}${endpoint}`, {
                ...fetchOptions,
                headers,
            });
        } catch (reauthError) {
            console.error('[API] Reauthorization failed:', reauthError);
            await removeToken();
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
            throw new Error('Session expired. Please log in again.');
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText || 'API Request Failed');
    }

    return response.json();
}

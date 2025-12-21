import { getToken } from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.besideu.alimad.co';

type RequestOptions = RequestInit & {
    requiresAuth?: boolean;
};

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


    const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText || 'API Request Failed');
    }

    return response.json();
}

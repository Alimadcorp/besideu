import { verifyAuthToken, getTokenFromRequest } from './jwt';

export async function getCurrentUserFromRequest(req) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return { user: null, error: 'Missing Authorization header' };
    }

    const payload = verifyAuthToken(token);
    if (!payload || !payload.sub) {
      return { user: null, error: 'Invalid token payload' };
    }

    return {
      user: {
        id: payload.sub,
        phone: payload.phone,
        username: payload.username,
      },
      error: null,
    };
  } catch (err) {
    console.error('[authUser] Failed to verify token', err);
    return { user: null, error: 'Invalid or expired token' };
  }
}



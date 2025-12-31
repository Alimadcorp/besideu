import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.warn('[jwt] JWT_SECRET is not set. Tokens cannot be signed/verified.');
}

export function signAuthToken(payload) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyAuthToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.verify(token, JWT_SECRET);
}

export function getTokenFromRequest(req) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}



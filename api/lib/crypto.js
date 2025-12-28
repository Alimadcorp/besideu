import crypto from 'crypto';

const GLOBAL_SALT = 'BESIDEU_PRIVATE_SALT_2024_@_ALIMAD_CORP';

/**
 * Normalizes and hashes a phone number for privacy-focused discovery.
 * @param {string} phone Raw phone number string
 * @returns {string} SHA-256 hash of (normalized_phone + salt)
 */
export function hashPhone(phone) {
    if (!phone) return '';
    // Normalize: remove all non-digits except '+'
    const normalized = phone.trim().replace(/[^\d+]/g, '');
    return crypto.createHash('sha256').update(normalized + GLOBAL_SALT).digest('hex');
}

/**
 * Generates a privacy-preserving location hash from coordinates.
 * Quantizes coordinates to ~5km grid and hashes the result.
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @returns {string} SHA-256 hash of the grid cell
 */
export function hashLocation(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number') return '';
    // Grid size 0.05 degrees (~5.5km)
    const gridSize = 0.05;
    const gridLat = Math.floor(lat / gridSize);
    const gridLon = Math.floor(lon / gridSize);
    const gridString = `${gridLat}_${gridLon}`;
    return crypto.createHash('sha256').update(gridString + GLOBAL_SALT).digest('hex');
}

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
console.log(hashPhone("+923488747307"))

/**
 * Generates a privacy-preserving location hash from coordinates.
 * Quantizes coordinates to a grid of specified size (in km) and hashes the result.
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @param {number} gridSizeKm Grid size in kilometers (1, 3, or 5)
 * @returns {string} SHA-256 hash of the grid cell
 */
export function hashLocationGrid(lat, lon, gridSizeKm) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || typeof gridSizeKm !== 'number') return '';
    
    // Convert km to degrees (approximate: 1 degree ≈ 111 km)
    // More accurate: at equator 1 degree ≈ 111.32 km, but varies with latitude
    // Using 111 km per degree as a good approximation
    const degreesPerKm = 1 / 111;
    const gridSizeDegrees = gridSizeKm * degreesPerKm;
    
    const gridLat = Math.floor(lat / gridSizeDegrees);
    const gridLon = Math.floor(lon / gridSizeDegrees);
    const gridString = `${gridLat}_${gridLon}_${gridSizeKm}`;
    return crypto.createHash('sha256').update(gridString + GLOBAL_SALT).digest('hex');
}

/**
 * Generates all five location hashes (100m, 500m, 1km, 3km, 5km) for a given coordinate.
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @returns {object} Object with all location hashes
 */
export function hashLocationAll(lat, lon) {
    return {
        location_hash_100m: hashLocationGrid(lat, lon, 0.1), // 100m = 0.1km
        location_hash_500m: hashLocationGrid(lat, lon, 0.5), // 500m = 0.5km
        location_hash_1km: hashLocationGrid(lat, lon, 1),
        location_hash_3km: hashLocationGrid(lat, lon, 3),
        location_hash_5km: hashLocationGrid(lat, lon, 5),
    };
}

/**
 * Legacy function for backward compatibility - generates 5km hash
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @returns {string} SHA-256 hash of the 5km grid cell
 */
export function hashLocation(lat, lon) {
    return hashLocationGrid(lat, lon, 5);
}

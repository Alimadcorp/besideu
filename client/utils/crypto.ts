/**
 * Simple SHA-256 implementation in pure Javascript.
 * Used to avoid native dependency issues in React Native while providing privacy for phone numbers.
 */
function sha256(ascii: string) {
    function rightRotate(value: number, amount: number) {
        return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i, j; // Used as a counter across the whole file
    let result = '';

    const words: any = [];
    const asciiBitLength = ascii[lengthProperty] * 8;

    let hash = (sha256 as any).h = (sha256 as any).h || [];
    const k = (sha256 as any).k = (sha256 as any).k || [];
    let primeCounter = k[lengthProperty];

    const isPrime = (n: number) => {
        for (let factor = 2; factor * factor <= n; factor++) {
            if (n % factor === 0) return false;
        }
        return true;
    };

    const getFractionalBits = (n: number) => {
        return ((n ** .5) % 1 * maxWord) | 0;
    };

    for (let candidate = 2; primeCounter < 64; candidate++) {
        if (isPrime(candidate)) {
            if (primeCounter < 8) {
                hash[primeCounter] = getFractionalBits(candidate);
            }
            k[primeCounter] = (candidate ** (1 / 3) % 1 * maxWord) | 0;
            primeCounter++;
        }
    }

    ascii += '\x80'; // Append '1' bit (followed by zero bits)
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00'; // Zero-pad until length is 56 bytes (mod 64)
    for (i = 0; i < ascii[lengthProperty]; i++) {
        j = ascii.charCodeAt(i);
        if (j >> 8) return ''; // ASCII check: only accept characters in range 0-255
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength | 0);

    for (j = 0; j < words[lengthProperty]; j += 16) {
        const w = words.slice(j, j + 16);
        const oldHash = hash;
        hash = hash.slice(0, 8);

        for (i = 0; i < 64; i++) {
            const w15 = w[i - 15], w2 = w[i - 2];

            const a = hash[0], e = hash[4];
            const temp1 = hash[7]
                + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
                + ((e & hash[5]) ^ (~e & hash[6]))
                + k[i]
                + (w[i] = (i < 16) ? w[i] : (
                    w[i - 16]
                    + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
                    + w[i - 7]
                    + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
                ) | 0);
            const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
                + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

            hash = [(temp1 + temp2) | 0].concat(hash);
            hash[4] = (hash[4] + temp1) | 0;
        }

        for (i = 0; i < 8; i++) {
            hash[i] = (hash[i] + oldHash[i]) | 0;
        }
    }

    for (i = 0; i < 8; i++) {
        for (j = 3; j + 1; j--) {
            const b = (hash[i] >> (j * 8)) & 255;
            result += (b < 16 ? '0' : '') + b.toString(16);
        }
    }
    return result;
}

const GLOBAL_SALT = 'BESIDEU_PRIVATE_SALT_2024_@_ALIMAD_CORP';

/**
 * Normalizes a phone number by handling common local prefixes and removing non-digits.
 * Converts '03...' to '+923...' for Pakistan, and handles other basic normalization.
 * @param phone Raw phone number string
 * @returns Normalized phone number starting with '+'
 */
export function normalizePhoneNumber(phone: string): string {
    if (!phone) return '';

    // Remove all non-digits except '+'
    let normalized = phone.trim().replace(/[^\d+]/g, '');

    // Case: 03... -> +923... (Pakistan)
    if (normalized.startsWith('03') && normalized.length === 11) {
        normalized = '+92' + normalized.substring(1);
    }
    // Case: 00... -> +...
    else if (normalized.startsWith('00')) {
        normalized = '+' + normalized.substring(2);
    }
    // Case: Doesn't start with '+' and is likely local
    else if (!normalized.startsWith('+')) {
        // If it's 10 digits and starts with 3, assume it's Pakistan missing +92
        if (normalized.startsWith('3') && normalized.length === 10) {
            normalized = '+92' + normalized;
        }
    }
    // Case: +9203... -> +923...
    else if (normalized.startsWith('+920')) {
        normalized = '+92' + normalized.substring(4);
    }

    return normalized;
}

/**
 * Normalizes and hashes a phone number for privacy-focused discovery.
 * @param phone Raw phone number string
 * @returns SHA-256 hash of (normalized_phone + salt)
 */
export function hashPhone(phone: string): string {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) return '';
    return sha256(normalized + GLOBAL_SALT);
}

/**
 * Generates a privacy-preserving location hash from coordinates.
 * Quantizes coordinates to ~5km grid and hashes the result.
 * @param lat Latitude
 * @param lon Longitude
 * @returns SHA-256 hash of the grid cell
 */
export function hashLocation(lat: number, lon: number): string {
    // Grid size 0.05 degrees (~5.5km)
    const gridSize = 0.05;
    const gridLat = Math.floor(lat / gridSize);
    const gridLon = Math.floor(lon / gridSize);
    const gridString = `${gridLat}_${gridLon}`;
    return sha256(gridString + GLOBAL_SALT);
}

-- Migration to backfill phone_hash for existing users
-- Requires pgcrypto extension for SHA256

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update all users who don't have a phone_hash yet (or update all to be safe)
-- Logic matches api/lib/crypto.js:
-- 1. Trim whitespace
-- 2. Remove non-digit characters except '+'
-- 3. Append salt
-- 4. SHA256 hash
-- 5. Encode as hex

UPDATE users
SET phone_hash = encode(
    digest(
        regexp_replace(trim(phone), '[^0-9+]', '', 'g') || 'BESIDEU_PRIVATE_SALT_2024_@_ALIMAD_CORP',
        'sha256'
    ),
    'hex'
);

-- Verify
-- SELECT phone, phone_hash FROM users LIMIT 5;

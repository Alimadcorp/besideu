-- Add avatar_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Index not strictly necessary unless filtering, but good practice if widely used? No.

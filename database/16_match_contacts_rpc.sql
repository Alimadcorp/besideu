-- Create a function to find users by phone hash efficiently
-- This allows sending a large array of hashes in the body (RPC call) rather than URL parameters.

CREATE OR REPLACE FUNCTION match_contact_hashes(hashes text[])
RETURNS TABLE (
    id UUID,
    username TEXT,
    phone_hash TEXT
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT id, username, phone_hash
    FROM users
    WHERE phone_hash = ANY(hashes);
$$;

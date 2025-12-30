-- Fix message_reactions unique constraint to allow upsert by (message_id, user_id)
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_id_user_id_reaction_key;

-- Add unique constraint on (message_id, user_id) to allow one reaction per user per message
-- If a user reacts again, it replaces the old one.
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_message_id_user_id_key UNIQUE (message_id, user_id);

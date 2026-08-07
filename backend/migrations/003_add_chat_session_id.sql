-- Migration: Add session_id column to chats table for conversation grouping.
ALTER TABLE chats ADD COLUMN IF NOT EXISTS session_id UUID;

-- Group any existing chats into a single default session so we don't break history
UPDATE chats SET session_id = '00000000-0000-0000-0000-000000000000' WHERE session_id IS NULL;

-- Set default to generate random UUIDs for new chats
ALTER TABLE chats ALTER COLUMN session_id SET DEFAULT gen_random_uuid();

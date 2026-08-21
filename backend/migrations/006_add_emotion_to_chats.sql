-- Migration: Add emotion and score columns to chats table for caching chat message analysis.
ALTER TABLE chats
ADD COLUMN IF NOT EXISTS emotion VARCHAR(50),
ADD COLUMN IF NOT EXISTS score INTEGER;

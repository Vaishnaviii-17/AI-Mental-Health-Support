-- Migration: Add multilingual journal fields.

ALTER TABLE journals
ADD COLUMN IF NOT EXISTS original_language VARCHAR(5) NOT NULL DEFAULT 'en',
ADD COLUMN IF NOT EXISTS translated_content TEXT;

ALTER TABLE journals
DROP CONSTRAINT IF EXISTS journals_original_language_check;

ALTER TABLE journals
ADD CONSTRAINT journals_original_language_check
CHECK (original_language IN ('en', 'hi', 'mr'));

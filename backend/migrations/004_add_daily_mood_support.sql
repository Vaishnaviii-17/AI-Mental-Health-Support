-- Migration: Add Daily Mood Check-In Support

-- Optional note written by the user
ALTER TABLE moods
ADD COLUMN IF NOT EXISTS note TEXT;

-- Calendar date of the mood check-in
ALTER TABLE moods
ADD COLUMN IF NOT EXISTS mood_date DATE;

-- Automatically populate existing rows
UPDATE moods
SET mood_date = DATE(created_at)
WHERE mood_date IS NULL;

-- Future records should always have a mood date
ALTER TABLE moods
ALTER COLUMN mood_date SET NOT NULL;

-- Track updates
ALTER TABLE moods
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


-- Identify where the mood came from.
-- manual = user daily check-in
-- journal_ai = AI analysis of a journal

ALTER TABLE moods
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'journal_ai';

-- Existing mood records came from the journal/AI flow.
UPDATE moods
SET source = 'journal_ai'
WHERE source IS NULL;

-- Make sure source is always present.
ALTER TABLE moods
ALTER COLUMN source SET NOT NULL;

-- Remove the previous broad uniqueness constraint if it was added.
ALTER TABLE moods
DROP CONSTRAINT IF EXISTS moods_user_day_unique;

-- Only one MANUAL mood is allowed per user per day.
CREATE UNIQUE INDEX IF NOT EXISTS moods_manual_user_day_unique
ON moods (user_id, mood_date)
WHERE source = 'manual';
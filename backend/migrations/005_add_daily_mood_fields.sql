-- Add fields required for daily mood check-in

ALTER TABLE moods
ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE moods
ADD COLUMN IF NOT EXISTS mood_date DATE;

ALTER TABLE moods
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

ALTER TABLE moods
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


-- Existing rows should use their creation date
UPDATE moods
SET mood_date = created_at::date
WHERE mood_date IS NULL;


-- Existing rows are treated as manual moods
UPDATE moods
SET source = 'manual'
WHERE source IS NULL;


-- Make mood_date mandatory after existing rows are populated
ALTER TABLE moods
ALTER COLUMN mood_date SET NOT NULL;


-- Prevent multiple manual mood check-ins
-- for the same user on the same day
CREATE UNIQUE INDEX IF NOT EXISTS
unique_manual_mood_per_user_day
ON moods (user_id, mood_date)
WHERE source = 'manual';
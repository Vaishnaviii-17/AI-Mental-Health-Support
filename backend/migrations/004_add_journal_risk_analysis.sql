-- Migration: Add emotion and risk analysis fields to journals.

ALTER TABLE journals
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS risk_score DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS secondary_emotions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS risk_analysis JSONB;

-- Migration: Store optional voice-journal multimodal analysis details.

ALTER TABLE journals
ADD COLUMN IF NOT EXISTS multimodal_analysis JSONB;

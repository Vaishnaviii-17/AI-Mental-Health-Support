-- Migration 010: Add profile personalization columns
-- Adds avatar_id and intentions to the users table.
-- Safe: uses IF NOT EXISTS / does not touch existing columns or data.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_id  VARCHAR(30)  DEFAULT 'lotus',
  ADD COLUMN IF NOT EXISTS intentions TEXT[]        DEFAULT '{}';

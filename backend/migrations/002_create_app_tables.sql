-- Migration: Create application tables for chat, journal, moods, and update users profile.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Update users table with profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);

-- Create journals table
CREATE TABLE IF NOT EXISTS journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    mood VARCHAR(50),                 -- Emoji representation (e.g. "😊")
    emotion VARCHAR(50),              -- Emotion text (e.g. "Calm")
    sentiment_score INTEGER CHECK (sentiment_score >= 1 AND sentiment_score <= 5),
    insight TEXT,                     -- AI reflection or insight
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
    message TEXT NOT NULL,
    is_crisis BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create moods table for unified analytics check-ins
CREATE TABLE IF NOT EXISTS moods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(50) NOT NULL,
    emotion VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    confidence INTEGER DEFAULT 100,
    insight TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

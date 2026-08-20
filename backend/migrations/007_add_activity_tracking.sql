-- Migration: Create tables for activity sessions and feedback tracking.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create activity_sessions table
CREATE TABLE IF NOT EXISTS activity_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create activity_feedback table
CREATE TABLE IF NOT EXISTS activity_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_session_id UUID NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance and security lookups
CREATE INDEX IF NOT EXISTS idx_activity_sessions_user_type ON activity_sessions(user_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_feedback_session ON activity_feedback(activity_session_id);

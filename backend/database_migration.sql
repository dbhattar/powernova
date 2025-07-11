-- PowerNOVA User Profile and Settings Tables
-- Run this script to create the necessary tables for user profiles and settings

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    photo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification preferences
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    
    -- Display preferences
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- App preferences
    auto_play_voice BOOLEAN DEFAULT TRUE,
    voice_speed NUMERIC(2,1) DEFAULT 1.0,
    default_view VARCHAR(20) DEFAULT 'chat',
    
    -- Privacy settings
    analytics_enabled BOOLEAN DEFAULT TRUE,
    crash_reporting BOOLEAN DEFAULT TRUE,
    
    -- Advanced settings (JSON)
    custom_settings JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one settings record per user
    UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to update updated_at automatically
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add some constraints for data validation
ALTER TABLE user_settings 
ADD CONSTRAINT check_theme 
CHECK (theme IN ('light', 'dark', 'auto'));

ALTER TABLE user_settings 
ADD CONSTRAINT check_voice_speed 
CHECK (voice_speed >= 0.5 AND voice_speed <= 2.0);

ALTER TABLE user_settings 
ADD CONSTRAINT check_default_view 
CHECK (default_view IN ('chat', 'dashboard', 'projects', 'history', 'documents'));

-- Create QueueInfo table for ISO/RTO interconnection queue projects
CREATE TABLE IF NOT EXISTS QueueInfo (
    id SERIAL PRIMARY KEY,
    IsoID VARCHAR(20) NOT NULL,
    QueueID VARCHAR(100) NOT NULL,
    ProjectName VARCHAR(255),
    InterconnectingEntity VARCHAR(255),
    County VARCHAR(100),
    StateName VARCHAR(100),
    InterconnectionLocation VARCHAR(255),
    TransmissionOwner VARCHAR(255),
    GenerationType VARCHAR(100),
    CapacityMW DECIMAL(10,2),
    SummerCapacity DECIMAL(10,2),
    WinterCapacityMW DECIMAL(10,2),
    QueueDate DATE,
    Status VARCHAR(50),
    ProposedCompletionDate DATE,
    WithdrawnDate DATE,
    WithdrawalComment TEXT,
    ActualCompletionDate DATE,
    AdditionalInfo JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(IsoID, QueueID)
);

-- Create indexes for QueueInfo table performance
CREATE INDEX IF NOT EXISTS idx_queueinfo_iso_id ON QueueInfo(IsoID);
CREATE INDEX IF NOT EXISTS idx_queueinfo_status ON QueueInfo(Status);
CREATE INDEX IF NOT EXISTS idx_queueinfo_generation_type ON QueueInfo(GenerationType);
CREATE INDEX IF NOT EXISTS idx_queueinfo_county ON QueueInfo(County);
CREATE INDEX IF NOT EXISTS idx_queueinfo_state ON QueueInfo(StateName);
CREATE INDEX IF NOT EXISTS idx_queueinfo_queue_date ON QueueInfo(QueueDate);
CREATE INDEX IF NOT EXISTS idx_queueinfo_capacity ON QueueInfo(CapacityMW);

-- Create trigger for QueueInfo updated_at
DROP TRIGGER IF EXISTS update_queueinfo_updated_at ON QueueInfo;
CREATE TRIGGER update_queueinfo_updated_at
    BEFORE UPDATE ON QueueInfo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data (optional - remove in production)
-- This will create a test user with default settings
-- INSERT INTO users (firebase_uid, email, display_name) 
-- VALUES ('test-firebase-uid', 'test@example.com', 'Test User')
-- ON CONFLICT (firebase_uid) DO NOTHING;

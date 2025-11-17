-- PowerNOVA Database Initialization Script
-- This script runs when the PostgreSQL container starts for the first time
-- It sets up the database with optimizations and extensions

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- Create database statistics for query optimization
-- These will be created by Alembic migrations, but we can add custom indexes here

-- Example: Full-text search index for message content (for future RAG features)
-- This will be added after tables are created by migrations

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Note: Triggers will be added after Alembic creates the tables
-- Run this script after migrations:
-- 
-- CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- 
-- CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- 
-- CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- 
-- CREATE TRIGGER update_artifacts_updated_at BEFORE UPDATE ON artifacts
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Database optimization settings
ALTER DATABASE powernova SET timezone TO 'UTC';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'PowerNOVA database initialization completed successfully!';
END $$;

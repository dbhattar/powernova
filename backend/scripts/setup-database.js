#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POWERNOVA_HOST || 'localhost',
  port: process.env.POWERNOVA_PORT || 5432,
  database: process.env.POWERNOVA_DB || 'powernova',
  user: process.env.POWERNOVA_USER || 'postgres',
  password: process.env.POWERNOVA_PASSWORD || 'password',
});

const createQueueInfoTable = `
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(IsoID, QueueID)
);
`;

const createIndexes = `
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queueinfo_iso_id ON QueueInfo(IsoID);
CREATE INDEX IF NOT EXISTS idx_queueinfo_status ON QueueInfo(Status);
CREATE INDEX IF NOT EXISTS idx_queueinfo_generation_type ON QueueInfo(GenerationType);
CREATE INDEX IF NOT EXISTS idx_queueinfo_county ON QueueInfo(County);
CREATE INDEX IF NOT EXISTS idx_queueinfo_state ON QueueInfo(StateName);
CREATE INDEX IF NOT EXISTS idx_queueinfo_queue_date ON QueueInfo(QueueDate);
CREATE INDEX IF NOT EXISTS idx_queueinfo_capacity ON QueueInfo(CapacityMW);
`;

const createUpdatedAtTrigger = `
-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_queueinfo_updated_at ON QueueInfo;
CREATE TRIGGER update_queueinfo_updated_at
    BEFORE UPDATE ON QueueInfo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

async function setupDatabase() {
  try {
    console.log('Setting up PowerNOVA database schema...');
    
    // Create tables
    await pool.query(createQueueInfoTable);
    console.log('✓ Created QueueInfo table');
    
    // Create indexes
    await pool.query(createIndexes);
    console.log('✓ Created database indexes');
    
    // Create triggers
    await pool.query(createUpdatedAtTrigger);
    console.log('✓ Created update triggers');
    
    console.log('Database setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();

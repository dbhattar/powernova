#!/usr/bin/env node

const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POWERNOVA_HOST || 'localhost',
  port: process.env.POWERNOVA_PORT || 5432,
  database: process.env.POWERNOVA_DB || 'powernova',
  user: process.env.POWERNOVA_USER || 'postgres',
  password: process.env.POWERNOVA_PASSWORD || 'password',
});

async function runPythonScript() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../prototype-projects/backend/scripts/populate_queue_projects.py');
    const pythonProcess = spawn('python3', ['-c', `
import sys
sys.path.append('${path.dirname(scriptPath)}')
import populate_queue_projects
populate_queue_projects.setup_queue_info()
`]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString().trim());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(data.toString().trim());
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Python script completed successfully');
        resolve(output);
      } else {
        console.error(`Python script failed with code ${code}`);
        reject(new Error(`Python script failed: ${errorOutput}`));
      }
    });
  });
}

async function checkRequirements() {
  try {
    // Check if Python is available
    const pythonCheck = spawn('python3', ['--version']);
    await new Promise((resolve, reject) => {
      pythonCheck.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Python3 not found'));
        }
      });
    });

    // Check if required Python packages are installed
    const packagesCheck = spawn('python3', ['-c', 'import psycopg2, gridstatus, pandas, numpy']);
    await new Promise((resolve, reject) => {
      packagesCheck.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Required Python packages not installed. Please install: psycopg2, gridstatus, pandas, numpy'));
        }
      });
    });

    console.log('✓ Python requirements satisfied');
  } catch (error) {
    console.error('Requirements check failed:', error.message);
    throw error;
  }
}

async function verifyData() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM QueueInfo');
    const count = parseInt(result.rows[0].count);
    console.log(`Database contains ${count} queue projects`);
    
    if (count === 0) {
      console.log('Warning: No data found in database');
    }

    // Show sample data
    const sampleResult = await pool.query('SELECT IsoID, COUNT(*) as count FROM QueueInfo GROUP BY IsoID ORDER BY count DESC LIMIT 5');
    console.log('Sample data by ISO:');
    sampleResult.rows.forEach(row => {
      console.log(`  ${row.isoid}: ${row.count} projects`);
    });
    
  } catch (error) {
    console.error('Data verification failed:', error);
  }
}

async function populateDatabase() {
  try {
    console.log('Starting database population...');
    
    // Check requirements
    await checkRequirements();
    
    // Run the Python script to populate data
    await runPythonScript();
    
    // Verify the data was populated
    await verifyData();
    
    console.log('Database population completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database population failed:', error);
    process.exit(1);
  }
}

// Add script to package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = require(packageJsonPath);

if (!packageJson.scripts['populate-db']) {
  packageJson.scripts['populate-db'] = 'node scripts/populate-database.js';
  packageJson.scripts['setup-db'] = 'node scripts/setup-database.js';
  
  const fs = require('fs');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Added database scripts to package.json');
}

// Run if called directly
if (require.main === module) {
  populateDatabase();
}

module.exports = { populateDatabase };

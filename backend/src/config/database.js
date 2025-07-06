const { Pool } = require('pg');

// PowerNOVA Database Configuration
const powernovaPool = new Pool({
  host: process.env.POWERNOVA_HOST || 'localhost',
  port: process.env.POWERNOVA_PORT || 5432,
  database: process.env.POWERNOVA_DB || 'powernova',
  user: process.env.POWERNOVA_USER || 'postgres',
  password: process.env.POWERNOVA_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

let isConnected = false;

// Test the connection
powernovaPool.on('connect', () => {
  console.log('✅ Connected to PowerNOVA database');
  isConnected = true;
});

powernovaPool.on('error', (err) => {
  console.error('❌ PowerNOVA database connection error:', err.message);
  isConnected = false;
});

module.exports = {
  powernovaPool,
  isConnected: () => isConnected,
  // Helper function to execute queries with proper error handling
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await powernovaPool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text: text.substring(0, 50) + '...', duration, rows: res.rowCount });
      return res;
    } catch (err) {
      console.error('Database query error:', err.message);
      throw new Error(`Database query failed: ${err.message}`);
    }
  }
};

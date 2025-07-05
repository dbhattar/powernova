#!/usr/bin/env node

/**
 * Test script to check if the backend API is working
 */

const { exec } = require('child_process');

// Test if backend server is running
console.log('🔍 Testing backend server...');

// Check if server is running on port 3000
exec('lsof -i :3000', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ Backend server not running on port 3000');
    console.log('💡 Start the server with: npm run dev');
    return;
  }
  
  console.log('✅ Backend server is running on port 3000');
  console.log('Server process:', stdout.trim());
});

// Test basic API endpoint
setTimeout(() => {
  exec('curl -X GET http://localhost:3000/api/health', (error, stdout, stderr) => {
    if (error) {
      console.log('❌ Health check failed:', error.message);
      return;
    }
    
    console.log('✅ Health check response:', stdout);
  });
}, 1000);

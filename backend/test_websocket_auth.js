const io = require('socket.io-client');

// Simple test script to verify WebSocket authentication
const token = process.argv[2];

if (!token) {
  console.log('Usage: node test_websocket_auth.js <firebase_token>');
  process.exit(1);
}

console.log('🔗 Testing WebSocket connection with token...');

const socket = io('ws://localhost:9000', {
  auth: { token },
  transports: ['websocket'],
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected successfully!');
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ WebSocket connection failed:', error.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Connection timeout');
  process.exit(1);
}, 15000);

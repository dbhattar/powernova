const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
require('dotenv').config();

const authMiddleware = require('./middleware/authMiddleware');
const chatController = require('./controllers/chatController');
const documentController = require('./controllers/documentController');
const vectorController = require('./controllers/vectorController');
const projectsController = require('./controllers/projectsController');
const userController = require('./controllers/userController');
const webSocketManager = require('./services/webSocketManager');
const vectorizationWorker = require('./services/vectorizationWorker');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Body parsing middleware (increased limits for large document uploads)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', api: 'powernova-backend', timestamp: new Date().toISOString() });
});

// Test database connection (no auth required) - remove after testing
app.get('/api/test-db', async (req, res) => {
  try {
    const { query } = require('./config/database');
    await query('SELECT 1 as test');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      message: 'Database connection successful'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      message: error.message 
    });
  }
});

// API routes
app.use('/api/chat', authMiddleware, chatController);
app.use('/api/documents', authMiddleware, documentController);
app.use('/api/vectors', authMiddleware, vectorController);
app.use('/api/user', authMiddleware, userController);

// Projects health check (no auth required)
app.get('/api/projects/health', (req, res) => {
  res.json({ status: 'ok', service: 'projects', timestamp: new Date().toISOString() });
});

// Projects routes (auth required)
app.use('/api/projects', authMiddleware, projectsController);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// app.listen(PORT, () => {
//   console.log(`PowerNOVA Backend API running on port ${PORT}`);
//   console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
// });

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Initialize WebSocket
webSocketManager.initialize(server);

// Start vectorization worker
vectorizationWorker.start().catch(console.error);

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await vectorizationWorker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await vectorizationWorker.stop();
  process.exit(0);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 PowerNOVA Backend with WebSocket running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

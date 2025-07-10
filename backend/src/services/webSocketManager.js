const io = require('socket.io');

class WebSocketManager {
  constructor() {
    this.io = null;
    this.activeConnections = new Map(); // userId -> Set of socket IDs
  }

  initialize(server) {
    this.io = io(server, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.io.use(async (socket, next) => {
      try {
        // Get token from auth query parameter
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
          console.error('❌ WebSocket connection attempt without token');
          return next(new Error('Authentication token required'));
        }

        // Verify token using Firebase Admin
        const firebaseService = require('./firebaseService');
        const decodedToken = await firebaseService.verifyIdToken(token);
        
        socket.userId = decodedToken.uid;
        socket.userEmail = decodedToken.email;
        
        console.log(`✅ WebSocket authentication successful for user: ${decodedToken.uid}`);
        next();
      } catch (error) {
        console.error('❌ WebSocket authentication failed:', error.message);
        if (error.message.includes('token') || error.message.includes('expired')) {
          return next(new Error('Invalid or expired token'));
        }
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      console.log(`🔗 WebSocket connected for user ${userId}`);

      // Add to active connections
      if (!this.activeConnections.has(userId)) {
        this.activeConnections.set(userId, new Set());
      }
      this.activeConnections.get(userId).add(socket.id);

      // Handle ping/pong for keepalive
      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('disconnect', () => {
        console.log(`🔌 WebSocket disconnected for user ${userId}`);
        
        // Remove from active connections
        if (this.activeConnections.has(userId)) {
          this.activeConnections.get(userId).delete(socket.id);
          if (this.activeConnections.get(userId).size === 0) {
            this.activeConnections.delete(userId);
          }
        }
      });
    });

    console.log('🔗 WebSocket server initialized');
  }

  async sendToUser(userId, message) {
    if (!this.activeConnections.has(userId)) {
      console.log(`📡 No active connections for user ${userId}`);
      return false;
    }

    const socketIds = Array.from(this.activeConnections.get(userId));
    let sent = false;

    for (const socketId of socketIds) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        try {
          socket.emit('message', message);
          sent = true;
          console.log(`📡 Message sent to user ${userId}`);
        } catch (error) {
          console.error(`❌ Failed to send message to socket ${socketId}:`, error);
          // Remove failed connection
          this.activeConnections.get(userId).delete(socketId);
        }
      }
    }

    return sent;
  }

  async broadcast(message) {
    this.io.emit('message', message);
    console.log('📡 Message broadcasted to all users');
  }
}

module.exports = new WebSocketManager();

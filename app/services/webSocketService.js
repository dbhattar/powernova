import { io } from 'socket.io-client';
import { getAuth } from 'firebase/auth';
import { API_BASE_URL } from '../config/constants'; // Ensure this is defined in your constants file

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.listeners = {};
    this.isConnecting = false;
  }

  async connect() {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        console.error('❌ No authenticated user found for WebSocket connection');
        this.isConnecting = false;
        return;
      }

      // Get Firebase Auth token (force refresh to ensure it's valid)
      const token = await user.getIdToken(true);

      const wsUrl = API_BASE_URL?.replace('http', 'ws');

      console.log('🔗 Connecting to WebSocket:', wsUrl);
      
      this.socket = io(wsUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        
        // Send ping every 30 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
          if (this.socket?.connected) {
            this.socket.emit('ping');
          }
        }, 30000);
      });

      this.socket.on('message', (message) => {
        console.log('📡 WebSocket message received:', message);
        this.handleMessage(message);
      });

      this.socket.on('pong', () => {
        // Handle pong response
        console.log('🏓 WebSocket pong received');
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 WebSocket disconnected:', reason);
        this.isConnecting = false;
        clearInterval(this.pingInterval);
        this.attemptReconnect();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error.message);
        this.isConnecting = false;
        
        // If authentication failed, try to get a fresh token on next reconnect
        if (error.message.includes('Authentication')) {
          console.log('🔄 Authentication failed, will retry with fresh token');
        }
        
        this.attemptReconnect();
      });

    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      this.isConnecting = false;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.log('❌ Max reconnection attempts reached');
    }
  }

  handleMessage(message) {
    const { type, data } = message;
    
    // Emit to listeners
    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('❌ Error in WebSocket listener:', error);
        }
      });
    }
  }

  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
    
    console.log(`📡 WebSocket listener added for: ${eventType}`);
  }

  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
      console.log(`📡 WebSocket listener removed for: ${eventType}`);
    }
  }

  disconnect() {
    if (this.socket) {
      clearInterval(this.pingInterval);
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 WebSocket manually disconnected');
    }
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const webSocketService = new WebSocketService();

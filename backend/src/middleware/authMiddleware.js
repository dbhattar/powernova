const admin = require('../config/firebase');

/**
 * Middleware to verify Firebase ID tokens
 */
const authMiddleware = async (req, res, next) => {
  console.log('🔐 AUTH MIDDLEWARE ENTRY - URL:', req.method, req.url);
  console.log('🔐 AUTH MIDDLEWARE - Headers present:', Object.keys(req.headers));
  
  try {
    console.log('🔐 Auth middleware - URL:', req.method, req.url);
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid authorization header');
      return res.status(401).json({
        error: 'Unauthorized: Missing or invalid authorization header'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      console.log('❌ No token provided');
      return res.status(401).json({
        error: 'Unauthorized: No token provided'
      });
    }

    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Add user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture
    };

    console.log('✅ Auth successful - User:', req.user.uid);
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Unauthorized: Token expired'
      });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({
        error: 'Unauthorized: Invalid token format'
      });
    }
    
    return res.status(401).json({
      error: 'Unauthorized: Token verification failed'
    });
  }
};

module.exports = authMiddleware;

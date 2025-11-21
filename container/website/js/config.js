// PowerNOVA Configuration
// This file is replaced during build based on environment

(function() {
    'use strict';
    
    // Configuration - Set during Docker build
    // Default values are for production
    const config = {
        chatUrl: 'https://app.powernova.ai',
        apiUrl: 'https://api.powernova.ai',
        environment: 'production',
        
        // Firebase configuration for Google Analytics
        // Only active in production environment
        // For Firebase JS SDK v7.20.0 and later, measurementId is optional
        firebase: {
            apiKey: "AIzaSyDQiD7r9N1AT4l5aoI0Y3yj6YY2DKt7czM",
            authDomain: "powernova-6753c.firebaseapp.com",
            projectId: "powernova-6753c",
            storageBucket: "powernova-6753c.firebasestorage.app",
            messagingSenderId: "724076757764",
            appId: "1:724076757764:web:cd328f37ba41d2deaac651",
            measurementId: "G-XL0MQCC6TN"
        },        
        
        // Analytics configuration
        analytics: {
            enabled: true,
            trackPageViews: true,
            trackEvents: true,
            debug: false
        }
    };
    
    // Make config globally available
    window.PowerNOVA = window.PowerNOVA || {};
    window.PowerNOVA.config = config;
    
    // Helper function to get chat URL
    window.PowerNOVA.getChatUrl = function() {
        return config.chatUrl;
    };
    
    // Helper function to open chat app
    window.PowerNOVA.openChat = function() {
        window.open(config.chatUrl, '_blank');
    };
    
    // Log environment (only in non-production)
    if (config.environment !== 'production') {
        console.log(`[PowerNOVA] Environment: ${config.environment}`);
        console.log(`[PowerNOVA] Chat URL: ${config.chatUrl}`);
    }
    
})();


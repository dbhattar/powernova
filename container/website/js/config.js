// PowerNOVA Configuration
// This file is replaced during build based on environment

(function() {
    'use strict';
    
    // Configuration - Set during Docker build
    // Default values are for production
    const config = {
        chatUrl: 'https://app.powernova.ai',
        apiUrl: 'https://api.powernova.ai',
        environment: 'production'
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


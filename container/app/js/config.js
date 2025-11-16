// PowerNOVA Chat App - Configuration
// This file is replaced during build based on environment

(function() {
    'use strict';
    
    // Configuration - Set during Docker build
    // Default values are for production
    const config = {
        landingUrl: 'https://www.powernova.ai',
        apiUrl: 'https://api.powernova.ai',
        wsUrl: 'wss://api.powernova.ai',
        environment: 'production'
    };
    
    // Make config globally available
    window.PowerNOVA = window.PowerNOVA || {};
    window.PowerNOVA.config = config;
    
    // Helper functions
    window.PowerNOVA.getLandingUrl = function() {
        return config.landingUrl;
    };
    
    window.PowerNOVA.getApiUrl = function() {
        return config.apiUrl;
    };
    
    window.PowerNOVA.goToLanding = function() {
        window.location.href = config.landingUrl;
    };
    
    // Log environment (only in non-production)
    if (config.environment !== 'production') {
        console.log(`[PowerNOVA Chat] Environment: ${config.environment}`);
        console.log(`[PowerNOVA Chat] Landing URL: ${config.landingUrl}`);
        console.log(`[PowerNOVA Chat] API URL: ${config.apiUrl}`);
    }
    
})();

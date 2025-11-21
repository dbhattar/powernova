// PowerNOVA Chat App - Configuration - LOCAL DEVELOPMENT
// This file is used for local development only

(function() {
    'use strict';
    
    // Configuration - Local development
    const config = {
        landingUrl: 'http://localhost:8080',
        apiUrl: 'http://localhost:8000',
        wsUrl: 'ws://localhost:8000',
        environment: 'local',
        
        // Firebase/Analytics disabled in local development
        firebase: null,
        
        analytics: {
            enabled: false,
            trackPageViews: false,
            trackEvents: false,
            debug: false
        }
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
    
    // Log environment
    console.log('[PowerNOVA Chat] 🏠 LOCAL DEVELOPMENT MODE');
    console.log('[PowerNOVA Chat] Landing URL:', config.landingUrl);
    console.log('[PowerNOVA Chat] API URL:', config.apiUrl);
    console.log('[PowerNOVA Chat] WebSocket URL:', config.wsUrl);
    console.log('[PowerNOVA Chat] Analytics: DISABLED');
    
})();
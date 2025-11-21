// PowerNOVA Configuration - LOCAL DEVELOPMENT
// This file is used for local development only

(function() {
    'use strict';
    
    // Configuration - Local development
    const config = {
        chatUrl: 'http://localhost:8081',
        apiUrl: 'http://localhost:8000',
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
    
    // Helper function to get chat URL
    window.PowerNOVA.getChatUrl = function() {
        return config.chatUrl;
    };
    
    // Helper function to open chat app
    window.PowerNOVA.openChat = function() {
        window.open(config.chatUrl, '_blank');
    };
    
    // Update links on page load for local development
    document.addEventListener('DOMContentLoaded', function() {
        // Find all links that point to app.powernova.ai
        const chatLinks = document.querySelectorAll('a[href*="app.powernova.ai"]');
        
        chatLinks.forEach(link => {
            // Replace production URL with local URL
            link.href = link.href.replace('https://app.powernova.ai', config.chatUrl);
            
            // Add visual indicator for local development
            if (!link.querySelector('.local-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'local-indicator';
                indicator.innerHTML = ' <small style="opacity:0.7;color:#10b981">(→ local:8081)</small>';
                link.appendChild(indicator);
            }
        });
        
        console.log('[PowerNOVA] 🏠 LOCAL DEVELOPMENT MODE');
        console.log('[PowerNOVA] Chat URL:', config.chatUrl);
        console.log('[PowerNOVA] API URL:', config.apiUrl);
        console.log('[PowerNOVA] Analytics: DISABLED');
    });
    
})();

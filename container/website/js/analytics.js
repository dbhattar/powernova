// ==================== //
// Google Analytics      //
// Landing Page Tracking //
// ==================== //

/**
 * Google Analytics Module for PowerNOVA Landing Page
 * Tracks visitor statistics and basic interactions
 * Only initializes in production environment
 */

const Analytics = {
    initialized: false,
    analytics: null,
    
    /**
     * Initialize Google Analytics via Firebase
     */
    async init() {
        // Check if analytics is enabled in config
        const config = window.PowerNOVA?.config;
        
        if (!config || !config.analytics?.enabled || config.environment !== 'production') {
            console.log('[Analytics] Disabled in non-production environment');
            return;
        }
        
        if (!config.firebase) {
            console.error('[Analytics] Firebase config missing');
            return;
        }
        
        try {
            // Check if Firebase is loaded
            if (typeof firebase === 'undefined') {
                console.error('[Analytics] Firebase SDK not loaded');
                return;
            }
            
            // Initialize Firebase
            firebase.initializeApp(config.firebase);
            
            // Initialize Analytics
            this.analytics = firebase.analytics();
            this.initialized = true;
            
            console.log('[Analytics] ✅ Google Analytics initialized for landing page');
            
            // Track initial page view
            if (config.analytics.trackPageViews) {
                this.trackPageView();
            }
            
        } catch (error) {
            console.error('[Analytics] Initialization error:', error);
        }
    },
    
    /**
     * Track page view
     */
    trackPageView(pagePath = null) {
        if (!this.initialized || !this.analytics) return;
        
        try {
            this.analytics.logEvent('page_view', {
                page_path: pagePath || window.location.pathname,
                page_title: document.title,
                page_location: window.location.href
            });
            
            if (window.PowerNOVA?.config?.analytics?.debug) {
                console.log('[Analytics] Page view tracked:', pagePath || window.location.pathname);
            }
        } catch (error) {
            console.error('[Analytics] Error tracking page view:', error);
        }
    },
    
    /**
     * Track custom event
     * @param {string} eventName - Name of the event
     * @param {object} parameters - Event parameters
     */
    trackEvent(eventName, parameters = {}) {
        if (!this.initialized || !this.analytics) return;
        if (!window.PowerNOVA?.config?.analytics?.trackEvents) return;
        
        try {
            this.analytics.logEvent(eventName, parameters);
            
            if (window.PowerNOVA?.config?.analytics?.debug) {
                console.log('[Analytics] Event tracked:', eventName, parameters);
            }
        } catch (error) {
            console.error('[Analytics] Error tracking event:', error);
        }
    },
    
    /**
     * Track CTA button click
     * @param {string} buttonText - Button text or ID
     * @param {string} location - Where on page (hero, features, pricing, etc.)
     */
    trackCTAClick(buttonText, location = 'unknown') {
        this.trackEvent('cta_click', {
            button_text: buttonText,
            section: location
        });
    },
    
    /**
     * Track navigation to chat app
     * @param {string} source - Where the link was clicked from
     */
    trackChatNavigation(source = 'unknown') {
        this.trackEvent('navigate_to_chat', {
            source: source
        });
    },
    
    /**
     * Track section scroll into view
     * @param {string} sectionName - Name of the section
     */
    trackSectionView(sectionName) {
        this.trackEvent('section_view', {
            section: sectionName
        });
    },
    
    /**
     * Track outbound link click
     * @param {string} url - Destination URL
     * @param {string} linkText - Link text
     */
    trackOutboundLink(url, linkText = '') {
        this.trackEvent('outbound_link_click', {
            destination: url,
            link_text: linkText
        });
    }
};

// Make Analytics globally available
window.PowerNOVA = window.PowerNOVA || {};
window.PowerNOVA.Analytics = Analytics;

// Auto-initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
    await Analytics.init();
    
    // Track CTA clicks automatically
    if (Analytics.initialized) {
        // Track all links to chat app
        document.querySelectorAll('a[href*="app.powernova.ai"]').forEach(link => {
            link.addEventListener('click', () => {
                const section = link.closest('section')?.id || 'header';
                Analytics.trackChatNavigation(section);
            });
        });
        
        // Track primary CTA buttons
        document.querySelectorAll('.cta-btn, .btn-primary, [data-track-cta]').forEach(button => {
            button.addEventListener('click', () => {
                const section = button.closest('section')?.id || 'unknown';
                const text = button.textContent.trim();
                Analytics.trackCTAClick(text, section);
            });
        });
    }
});

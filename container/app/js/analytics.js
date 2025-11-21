// ==================== //
// Google Analytics      //
// ==================== //

/**
 * Google Analytics Module using Firebase
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
            
            console.log('[Analytics] ✅ Google Analytics initialized');
            
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
     * Track user login
     * @param {string} method - Login method (e.g., 'email', 'google')
     */
    trackLogin(method = 'email') {
        this.trackEvent('login', { method });
    },
    
    /**
     * Track user signup
     * @param {string} method - Signup method
     */
    trackSignup(method = 'email') {
        this.trackEvent('sign_up', { method });
    },
    
    /**
     * Track chat message sent
     * @param {object} params - Message parameters
     */
    trackChatMessage(params = {}) {
        this.trackEvent('chat_message_sent', {
            message_length: params.messageLength || 0,
            has_rag: params.hasRAG || false,
            conversation_length: params.conversationLength || 0
        });
    },
    
    /**
     * Track chat response received
     * @param {object} params - Response parameters
     */
    trackChatResponse(params = {}) {
        this.trackEvent('chat_response_received', {
            response_length: params.responseLength || 0,
            response_time_ms: params.responseTime || 0,
            had_rag_context: params.hadRAG || false
        });
    },
    
    /**
     * Track new chat started
     */
    trackNewChat() {
        this.trackEvent('new_chat_started', {
            timestamp: new Date().toISOString()
        });
    },
    
    /**
     * Track follow-up question clicked
     * @param {string} questionText - The question that was clicked
     */
    trackFollowUpClick(questionText) {
        this.trackEvent('follow_up_question_clicked', {
            question: questionText
        });
    },
    
    /**
     * Track example question clicked
     * @param {string} questionText - The example question
     */
    trackExampleClick(questionText) {
        this.trackEvent('example_question_clicked', {
            question: questionText
        });
    },
    
    /**
     * Track search/query
     * @param {string} query - Search query
     */
    trackSearch(query) {
        this.trackEvent('search', {
            search_term: query
        });
    },
    
    /**
     * Track error
     * @param {string} errorType - Type of error
     * @param {string} errorMessage - Error message
     */
    trackError(errorType, errorMessage) {
        this.trackEvent('error', {
            error_type: errorType,
            error_message: errorMessage
        });
    },
    
    /**
     * Set user properties
     * @param {object} properties - User properties
     */
    setUserProperties(properties) {
        if (!this.initialized || !this.analytics) return;
        
        try {
            this.analytics.setUserProperties(properties);
            
            if (window.PowerNOVA?.config?.analytics?.debug) {
                console.log('[Analytics] User properties set:', properties);
            }
        } catch (error) {
            console.error('[Analytics] Error setting user properties:', error);
        }
    },
    
    /**
     * Set user ID (for logged-in users)
     * @param {string} userId - User ID
     */
    setUserId(userId) {
        if (!this.initialized || !this.analytics) return;
        
        try {
            this.analytics.setUserId(userId);
            
            if (window.PowerNOVA?.config?.analytics?.debug) {
                console.log('[Analytics] User ID set:', userId);
            }
        } catch (error) {
            console.error('[Analytics] Error setting user ID:', error);
        }
    }
};

// Make Analytics globally available
window.PowerNOVA = window.PowerNOVA || {};
window.PowerNOVA.Analytics = Analytics;

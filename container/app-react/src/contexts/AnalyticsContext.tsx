import { createContext, useContext, useEffect, ReactNode } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics, logEvent, setUserId, setUserProperties } from 'firebase/analytics';

interface AnalyticsContextType {
  trackEvent: (eventName: string, parameters?: Record<string, any>) => void;
  trackPageView: (pagePath?: string) => void;
  trackLogin: (method?: string) => void;
  trackSignup: (method?: string) => void;
  trackChatMessage: (params?: ChatMessageParams) => void;
  trackChatResponse: (params?: ChatResponseParams) => void;
  trackNewChat: () => void;
  trackFollowUpClick: (questionText: string) => void;
  trackExampleClick: (questionText: string) => void;
  trackSearch: (query: string) => void;
  trackError: (errorType: string, errorMessage: string) => void;
  setAnalyticsUserId: (userId: string) => void;
  setAnalyticsUserProperties: (properties: Record<string, any>) => void;
}

interface ChatMessageParams {
  messageLength?: number;
  hasRAG?: boolean;
  conversationLength?: number;
}

interface ChatResponseParams {
  responseLength?: number;
  responseTime?: number;
  hadRAG?: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  let analytics: Analytics | null = null;
  let firebaseApp: FirebaseApp | null = null;
  let initialized = false;

  useEffect(() => {
    // Initialize Firebase Analytics
    const initAnalytics = () => {
      // Check if we're in production
      const isDevelopment = import.meta.env.DEV;
      const firebaseConfig = import.meta.env.VITE_FIREBASE_CONFIG;

      if (isDevelopment) {
        console.log('[Analytics] Disabled in development environment');
        return;
      }

      if (!firebaseConfig) {
        console.warn('[Analytics] Firebase config not found in environment variables');
        return;
      }

      try {
        // Parse Firebase config
        const config = JSON.parse(firebaseConfig);

        // Initialize Firebase
        firebaseApp = initializeApp(config);

        // Initialize Analytics
        analytics = getAnalytics(firebaseApp);
        initialized = true;

        console.log('[Analytics] ✅ Google Analytics initialized');

        // Track initial page view
        trackPageView();
      } catch (error) {
        console.error('[Analytics] Initialization error:', error);
      }
    };

    initAnalytics();
  }, []);

  const trackEvent = (eventName: string, parameters: Record<string, any> = {}) => {
    if (!initialized || !analytics) return;

    try {
      logEvent(analytics, eventName, parameters);

      if (import.meta.env.VITE_ANALYTICS_DEBUG === 'true') {
        console.log('[Analytics] Event tracked:', eventName, parameters);
      }
    } catch (error) {
      console.error('[Analytics] Error tracking event:', error);
    }
  };

  const trackPageView = (pagePath?: string) => {
    if (!initialized || !analytics) return;

    try {
      logEvent(analytics, 'page_view', {
        page_path: pagePath || window.location.pathname,
        page_title: document.title,
        page_location: window.location.href,
      });

      if (import.meta.env.VITE_ANALYTICS_DEBUG === 'true') {
        console.log('[Analytics] Page view tracked:', pagePath || window.location.pathname);
      }
    } catch (error) {
      console.error('[Analytics] Error tracking page view:', error);
    }
  };

  const trackLogin = (method = 'email') => {
    trackEvent('login', { method });
  };

  const trackSignup = (method = 'email') => {
    trackEvent('sign_up', { method });
  };

  const trackChatMessage = (params: ChatMessageParams = {}) => {
    trackEvent('chat_message_sent', {
      message_length: params.messageLength || 0,
      has_rag: params.hasRAG || false,
      conversation_length: params.conversationLength || 0,
    });
  };

  const trackChatResponse = (params: ChatResponseParams = {}) => {
    trackEvent('chat_response_received', {
      response_length: params.responseLength || 0,
      response_time_ms: params.responseTime || 0,
      had_rag_context: params.hadRAG || false,
    });
  };

  const trackNewChat = () => {
    trackEvent('new_chat_started', {
      timestamp: new Date().toISOString(),
    });
  };

  const trackFollowUpClick = (questionText: string) => {
    trackEvent('follow_up_question_clicked', {
      question: questionText,
    });
  };

  const trackExampleClick = (questionText: string) => {
    trackEvent('example_question_clicked', {
      question: questionText,
    });
  };

  const trackSearch = (query: string) => {
    trackEvent('search', {
      search_term: query,
    });
  };

  const trackError = (errorType: string, errorMessage: string) => {
    trackEvent('error', {
      error_type: errorType,
      error_message: errorMessage,
    });
  };

  const setAnalyticsUserId = (userId: string) => {
    if (!initialized || !analytics) return;

    try {
      setUserId(analytics, userId);

      if (import.meta.env.VITE_ANALYTICS_DEBUG === 'true') {
        console.log('[Analytics] User ID set:', userId);
      }
    } catch (error) {
      console.error('[Analytics] Error setting user ID:', error);
    }
  };

  const setAnalyticsUserProperties = (properties: Record<string, any>) => {
    if (!initialized || !analytics) return;

    try {
      setUserProperties(analytics, properties);

      if (import.meta.env.VITE_ANALYTICS_DEBUG === 'true') {
        console.log('[Analytics] User properties set:', properties);
      }
    } catch (error) {
      console.error('[Analytics] Error setting user properties:', error);
    }
  };

  return (
    <AnalyticsContext.Provider
      value={{
        trackEvent,
        trackPageView,
        trackLogin,
        trackSignup,
        trackChatMessage,
        trackChatResponse,
        trackNewChat,
        trackFollowUpClick,
        trackExampleClick,
        trackSearch,
        trackError,
        setAnalyticsUserId,
        setAnalyticsUserProperties,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

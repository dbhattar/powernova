# Google Analytics Integration Guide

**Date**: November 20, 2025  
**Status**: ✅ Implemented (Configuration Required)

## Overview

Google Analytics has been integrated into the PowerNOVA Chat application using Firebase Analytics. The integration is **production-only** and will NOT track any data in local development environments.

## Features Implemented

### ✅ Automatic Page Tracking
- Tracks page views automatically on app load
- Records page path, title, and full URL

### ✅ User Authentication Tracking
- **Login events**: Tracks successful logins with method (email)
- **User ID**: Sets user ID for logged-in users
- **User properties**: Tracks user type (admin/user) and email verification status

### ✅ Chat Interaction Tracking
- **Message sent**: Tracks when users send messages (with message length, conversation length)
- **Response received**: Can track AI response metrics (response time, length)
- **New chat started**: Tracks when users start a new conversation

### ✅ Engagement Tracking
- **Example questions clicked**: Tracks which example questions users click
- **Follow-up questions clicked**: Tracks which AI-generated follow-ups are selected
- **Search queries**: Can track specific search terms

### ✅ Error Tracking
- Can track application errors with type and message

## Configuration Steps

### 1. Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Go to **Project Settings** (gear icon)
4. Scroll down to "Your apps" section
5. Click on the web app (</> icon) or add one if you haven't
6. Copy the Firebase configuration object

You'll see something like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456",
  measurementId: "G-XXXXXXXXXX"
};
```

### 2. Enable Google Analytics in Firebase

1. In Firebase Console, go to **Analytics** in the left sidebar
2. If not enabled, click **Enable Google Analytics**
3. Follow the setup wizard
4. Note your **Measurement ID** (starts with `G-`)

### 3. Update Production Configuration

Edit `app/js/config.js` and replace the placeholder values with your Firebase config:

```javascript
// Firebase configuration for Google Analytics
// Only active in production environment
firebase: {
    apiKey: "YOUR_ACTUAL_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"  // G-XXXXXXXXXX
}
```

**Example** (with real values):
```javascript
firebase: {
    apiKey: "AIzaSyDmP8k3J7sN9_QxFp2rVwL6hT3kY8mN5zA",
    authDomain: "powernova-ai.firebaseapp.com",
    projectId: "powernova-ai",
    storageBucket: "powernova-ai.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123def456",
    measurementId: "G-ABC123DEF4"
}
```

### 4. Deploy to Production

After updating the configuration:

```bash
# Build and deploy the chat app
cd docker
docker-compose -f docker-compose.app.yml up -d --build
```

Or deploy to Azure:
```bash
# Push to Azure App Service
git push azure main
```

### 5. Verify Analytics is Working

1. **In Firebase Console**:
   - Go to **Analytics → Events** (left sidebar)
   - Select **DebugView** to see real-time events
   - Visit your production site and interact with it
   - You should see events appearing in DebugView

2. **In Browser Console** (if debug enabled):
   - Open browser DevTools (F12)
   - You should see: `[Analytics] ✅ Google Analytics initialized`
   - Events will be logged if `analytics.debug: true` in config

3. **Test Events**:
   - Visit the chat page → Should log `page_view`
   - Click an example question → Should log `example_question_clicked`
   - Send a message → Should log `chat_message_sent`
   - Log in → Should log `login`
   - Start new chat → Should log `new_chat_started`

## Analytics Events Reference

### Automatically Tracked Events

| Event Name | When Triggered | Parameters |
|------------|----------------|------------|
| `page_view` | Page loads | `page_path`, `page_title`, `page_location` |
| `login` | User logs in | `method` (email) |
| `chat_message_sent` | User sends message | `message_length`, `conversation_length` |
| `new_chat_started` | User starts new chat | `timestamp` |
| `example_question_clicked` | User clicks example | `question` |
| `follow_up_question_clicked` | User clicks follow-up | `question` |

### Available for Custom Tracking

| Event Name | Method | Parameters |
|------------|--------|------------|
| `chat_response_received` | `trackChatResponse()` | `response_length`, `response_time_ms`, `had_rag_context` |
| `search` | `trackSearch()` | `search_term` |
| `error` | `trackError()` | `error_type`, `error_message` |
| `sign_up` | `trackSignup()` | `method` |

### User Properties Set

- `user_id`: User's database ID (set on login)
- `user_type`: "admin" or "user"
- `email_verified`: true/false

## Environment-Specific Behavior

### Production (`config.js`)
- ✅ Firebase SDK loaded
- ✅ Analytics initialized
- ✅ All events tracked
- ✅ User properties set
- ❌ No console logs (unless debug: true)

### Local Development (`config.local.js`)
- ❌ Firebase SDK NOT loaded
- ❌ Analytics NOT initialized
- ❌ No tracking occurs
- ✅ Console shows: `[Analytics] Disabled in non-production environment`

## Privacy & Compliance

### Data Collected
- Page views and navigation
- User interactions (clicks, messages sent)
- User authentication status
- Session duration
- Device and browser information (automatic by GA4)

### No PII Collected
- ❌ Message content is NOT sent to Analytics
- ❌ Passwords are NEVER tracked
- ❌ Email addresses are NOT sent (only user IDs)
- ❌ Personal data from forms is NOT tracked

### GDPR Compliance
Consider adding:
1. Cookie consent banner (if required by jurisdiction)
2. Privacy policy mentioning Google Analytics
3. User opt-out mechanism

## Debugging

### Enable Debug Mode

In `app/js/config.js`, set:
```javascript
analytics: {
    enabled: true,
    trackPageViews: true,
    trackEvents: true,
    debug: true  // Enable console logging
}
```

### Check Initialization

Open browser console and look for:
```
[Analytics] ✅ Google Analytics initialized
[Analytics] Page view tracked: /
```

### Common Issues

**Analytics not initializing:**
- Check Firebase config is correct in `config.js`
- Verify Firebase SDK scripts are loading (check Network tab)
- Ensure `environment: 'production'` in config
- Check browser console for errors

**Events not appearing in Firebase:**
- Events can take 24-48 hours to appear in standard reports
- Use **DebugView** in Firebase Console for real-time events
- Make sure debug mode is enabled
- Check that `analytics.enabled: true`

**Local development tracking production:**
- Make sure you're using `config.local.js` in local builds
- Check Dockerfile.app.local replaces config correctly
- Verify console shows "LOCAL DEVELOPMENT MODE"

## Custom Event Examples

### Track Response Time
```javascript
const startTime = Date.now();
// ... AI response happens ...
const responseTime = Date.now() - startTime;

if (window.PowerNOVA?.Analytics) {
    window.PowerNOVA.Analytics.trackChatResponse({
        responseLength: responseText.length,
        responseTime: responseTime,
        hadRAG: usedRAG
    });
}
```

### Track Search
```javascript
if (window.PowerNOVA?.Analytics) {
    window.PowerNOVA.Analytics.trackSearch(searchQuery);
}
```

### Track Errors
```javascript
try {
    // ... code ...
} catch (error) {
    if (window.PowerNOVA?.Analytics) {
        window.PowerNOVA.Analytics.trackError('api_error', error.message);
    }
}
```

## Firebase Analytics Dashboard

### Key Metrics to Monitor

1. **Engagement**:
   - Daily Active Users (DAU)
   - Session duration
   - Messages per session

2. **Feature Usage**:
   - Example question click rate
   - Follow-up question engagement
   - RAG vs non-RAG queries

3. **User Behavior**:
   - Login/signup rates
   - Retention (1-day, 7-day, 30-day)
   - Churn rate

4. **Technical**:
   - Error rates
   - Response times
   - Browser/device distribution

## Files Modified

1. `app/js/config.js` - Added Firebase config (production)
2. `app/js/config.local.js` - Disabled analytics (local)
3. `app/js/analytics.js` - New analytics module
4. `app/index.html` - Added Firebase SDK scripts
5. `app/js/app.js` - Integrated analytics tracking

## Next Steps

1. ✅ Add your Firebase configuration to `app/js/config.js`
2. ✅ Deploy to production
3. ✅ Verify events in Firebase DebugView
4. ⏳ Set up custom reports in Firebase Console
5. ⏳ Configure conversion events (e.g., "completed_chat")
6. ⏳ Set up audiences for retargeting
7. ⏳ Add cookie consent if required

## Support

- Firebase Documentation: https://firebase.google.com/docs/analytics
- GA4 Event Reference: https://support.google.com/analytics/answer/9267735
- Firebase Console: https://console.firebase.google.com/

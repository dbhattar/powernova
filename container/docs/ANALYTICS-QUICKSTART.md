# Google Analytics Integration Summary

## ✅ What's Been Done

### 1. Firebase/Google Analytics Setup (Production Only)
- Added Firebase configuration to `app/js/config.js` (production)
- Explicitly disabled analytics in `app/js/config.local.js` (local development)
- Created dedicated analytics module (`app/js/analytics.js`)
- Integrated Firebase SDK loading in `app/index.html` (conditional)

### 2. Automatic Event Tracking
The following events are now automatically tracked in production:

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| **page_view** | App loads | Page path, title, URL |
| **login** | User logs in | Method (email), user ID, user type |
| **chat_message_sent** | User sends message | Message length, conversation length |
| **example_question_clicked** | User clicks example | Question text |
| **follow_up_question_clicked** | User clicks AI suggestion | Question text |
| **new_chat_started** | User starts new conversation | Timestamp |

### 3. Privacy-First Implementation
- ❌ **No message content** is sent to Analytics
- ❌ **No passwords** are tracked
- ❌ **No email addresses** in events (only anonymized user IDs)
- ✅ Only anonymized user IDs and metadata
- ✅ Completely disabled in local development

### 4. Environment Awareness
- **Production**: Full analytics tracking with Firebase
- **Local Dev**: NO tracking, NO Firebase SDK loaded, console confirms disabled

## 🔧 What You Need to Do

### Step 1: Get Your Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one)
3. Go to **Project Settings** → **Your apps**
4. Copy the Firebase config object

### Step 2: Update config.js

Edit `app/js/config.js` and replace these placeholder values:

```javascript
firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",           // Replace this
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",  // Replace this
    projectId: "YOUR_PROJECT_ID",              // Replace this
    storageBucket: "YOUR_PROJECT_ID.appspot.com",   // Replace this
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",  // Replace this
    appId: "YOUR_APP_ID",                      // Replace this
    measurementId: "YOUR_MEASUREMENT_ID"       // Replace this (G-XXXXXXXXXX)
}
```

### Step 3: Enable Google Analytics in Firebase

1. In Firebase Console → **Analytics** (left sidebar)
2. Click **Enable Google Analytics** if not already enabled
3. Complete the setup wizard

### Step 4: Deploy to Production

```bash
cd docker
docker-compose -f docker-compose.app.yml up -d --build
```

Or push to Azure:
```bash
git push azure main
```

### Step 5: Verify It's Working

1. **Firebase Console** → **Analytics** → **DebugView**
2. Visit your production site
3. Interact with the app (send messages, click examples)
4. Watch events appear in real-time in DebugView

## 📊 Available Analytics Methods

You can manually track custom events in your code:

```javascript
// Available globally via window.PowerNOVA.Analytics

// Track search
Analytics.trackSearch(query);

// Track response received
Analytics.trackChatResponse({
    responseLength: 500,
    responseTime: 1200,
    hadRAG: true
});

// Track errors
Analytics.trackError('api_error', error.message);

// Set user properties
Analytics.setUserProperties({ 
    subscription_tier: 'premium' 
});

// Track custom events
Analytics.trackEvent('custom_event_name', {
    param1: 'value1',
    param2: 'value2'
});
```

## 📁 Files Created/Modified

**New Files:**
- `app/js/analytics.js` - Analytics module (269 lines)
- `docs/GOOGLE-ANALYTICS-SETUP.md` - Complete setup guide

**Modified Files:**
- `app/js/config.js` - Added Firebase config (production)
- `app/js/config.local.js` - Disabled analytics (local)
- `app/index.html` - Added Firebase SDK scripts
- `app/js/app.js` - Integrated analytics tracking calls

## 🔒 Privacy & Compliance

### What's Tracked:
- User interactions (clicks, navigation)
- Feature usage patterns
- Anonymous user IDs (for logged-in users)
- Session duration and engagement metrics

### What's NOT Tracked:
- Message content
- Passwords
- Email addresses
- Personal information
- Any data in local development

### Compliance:
- Consider adding a cookie consent banner
- Update your privacy policy to mention Google Analytics
- Provide opt-out mechanism if required by your jurisdiction

## 🐛 Testing in Local Development

When you run locally:

```bash
docker-compose up -d
```

Open browser console, you should see:
```
[PowerNOVA Chat] 🏠 LOCAL DEVELOPMENT MODE
[PowerNOVA Chat] Analytics: DISABLED
[Analytics] Disabled in non-production environment
```

✅ NO Firebase scripts loaded  
✅ NO analytics tracking occurs  
✅ NO data sent to Google  

## 📈 What to Monitor in Firebase

Once deployed, monitor these key metrics:

1. **User Engagement**:
   - Daily Active Users (DAU)
   - Average session duration
   - Messages per session

2. **Feature Adoption**:
   - Example question click rate
   - Follow-up question usage
   - New chat creation rate

3. **User Retention**:
   - 1-day retention
   - 7-day retention
   - 30-day retention

4. **Conversion Funnel**:
   - Visitors → First message
   - First message → Login
   - Login → Multiple sessions

## 🚀 Next Steps

After deployment:

1. ✅ Verify events in Firebase DebugView
2. ⏳ Set up custom dashboards
3. ⏳ Configure conversion events
4. ⏳ Set up user audiences for analysis
5. ⏳ Create custom reports
6. ⏳ Set up alerts for anomalies

## 📚 Documentation

Full setup guide: `docs/GOOGLE-ANALYTICS-SETUP.md`

Questions? The analytics module is fully commented and includes JSDoc documentation for all methods.

# Google Analytics - Website Landing Page Setup

**Date**: November 20, 2025  
**Status**: ✅ Implemented

## Overview

Google Analytics has been integrated into the PowerNOVA landing page (www.powernova.ai) for basic visitor statistics and engagement tracking. This is a simpler implementation focused on page views and navigation patterns.

## What's Tracked

### ✅ Automatic Tracking

1. **Page Views**
   - Tracks when visitors land on the website
   - Records page path, title, and URL
   - Automatic on page load

2. **CTA Button Clicks**
   - Tracks clicks on "Try PowerNOVA Chat", "Get Started", etc.
   - Records button text and section location
   - Auto-tracked for buttons with classes: `.cta-btn`, `.btn-primary`, or `[data-track-cta]`

3. **Navigation to Chat App**
   - Tracks when users click links to app.powernova.ai
   - Records which section the link was clicked from
   - Auto-tracked for all chat app links

### 🎯 Available Custom Events

You can manually track additional events:

```javascript
// Track section viewed
Analytics.trackSectionView('pricing');

// Track CTA click (manual)
Analytics.trackCTAClick('Download Whitepaper', 'resources');

// Track outbound link
Analytics.trackOutboundLink('https://example.com', 'Partner Site');

// Track custom event
Analytics.trackEvent('video_played', {
    video_title: 'Product Demo',
    duration: 120
});
```

## Configuration

### Production (website/js/config.js)

Add your Firebase configuration:

```javascript
firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
}
```

**Note**: Use the **same Firebase project** as the chat app for unified analytics!

### Local Development (website/js/config.local.js)

Analytics is automatically disabled:
- ❌ NO Firebase SDK loaded
- ❌ NO tracking occurs
- ✅ Console confirms: "Analytics: DISABLED"

## Files Modified

1. **website/js/config.js** - Added Firebase config (production)
2. **website/js/config.local.js** - Disabled analytics (local)
3. **website/js/analytics.js** - New analytics module (171 lines)
4. **website/index.html** - Added Firebase SDK scripts

## Usage in HTML

### Auto-Tracked Elements

Any element with these classes is automatically tracked:

```html
<!-- CTA Buttons (auto-tracked) -->
<button class="cta-btn">Try PowerNOVA</button>
<a href="#" class="btn-primary">Get Started</a>
<button data-track-cta>Download</button>

<!-- Chat App Links (auto-tracked) -->
<a href="https://app.powernova.ai">Open Chat</a>
```

### Manual Tracking

Add custom tracking to specific elements:

```html
<!-- Video play tracking -->
<video id="demo-video">
  <source src="demo.mp4">
</video>

<script>
document.getElementById('demo-video').addEventListener('play', () => {
    Analytics.trackEvent('video_played', {
        video_id: 'product_demo',
        section: 'hero'
    });
});
</script>
```

## Key Metrics to Monitor

### Traffic Metrics
- **Page Views**: Total visits to landing page
- **Unique Visitors**: Individual users
- **Session Duration**: Time spent on site
- **Bounce Rate**: Single-page visits

### Engagement Metrics
- **CTA Click Rate**: % of visitors clicking CTAs
- **Chat Navigation Rate**: % clicking through to chat app
- **Section Views**: Which sections users scroll to
- **Outbound Clicks**: External link clicks

### Conversion Funnel
1. Land on homepage
2. View features section
3. Click CTA button
4. Navigate to chat app
5. (Track continuation in chat app analytics)

## Unified Analytics Dashboard

Since both the landing page and chat app use the **same Firebase project**, you'll see:

### Combined Metrics
- **Total Users**: Across both landing page and chat app
- **User Journey**: Landing → Chat → Engagement
- **Conversion Rate**: Visitors → Active Users
- **Drop-off Points**: Where users leave the funnel

### Cross-Domain Tracking
Firebase automatically handles users moving from:
- www.powernova.ai (landing) → app.powernova.ai (chat)

You'll see the complete user journey in a single dashboard!

## Deployment

### Step 1: Add Firebase Config
Update `website/js/config.js` with your Firebase credentials (same as chat app).

### Step 2: Build and Deploy
```bash
cd docker
docker-compose -f docker-compose.yml up -d --build powernova-web
```

Or deploy to Azure:
```bash
git push azure main
```

### Step 3: Verify
1. Visit your production landing page
2. Open Firebase Console → Analytics → DebugView
3. You should see `page_view` event
4. Click a CTA button → See `cta_click` event
5. Click chat link → See `navigate_to_chat` event

## Privacy & Compliance

### Data Collected
- Page views and navigation
- Button/link clicks
- Session duration
- Browser and device info (automatic by GA4)

### Data NOT Collected
- ❌ Form submissions (unless explicitly tracked)
- ❌ Personal information
- ❌ Email addresses
- ❌ User input

### Same Privacy Policy
Since you're using the same Firebase project for both landing and chat:
- Use a **single privacy policy** covering both domains
- Mention Google Analytics usage
- Provide opt-out mechanism if required

## Testing in Local Development

When you run locally:
```bash
docker-compose up -d
```

Visit http://localhost:8080 and open console:
```
[PowerNOVA] 🏠 LOCAL DEVELOPMENT MODE
[PowerNOVA] Analytics: DISABLED
[Analytics] Disabled in non-production environment
```

✅ NO tracking occurs in local development!

## Example Analytics Reports

### Top Pages Report
```
Page                Views    Unique   Avg Duration
/                   10,000   7,500    2:15
/features          3,500    2,800    1:45
/about             1,200    900      1:20
```

### CTA Performance
```
Button Text           Clicks   Location   CTR
"Try PowerNOVA Chat"  850      Hero       8.5%
"Get Started"         420      Features   12%
"Learn More"          220      About      18%
```

### User Flow
```
Landing Page (100%)
  ↓ 65% scroll to Features
    ↓ 25% click CTA
      ↓ 18% navigate to Chat App
        ↓ 12% send first message (tracked in chat app)
```

## Comparison: Landing vs Chat Analytics

### Landing Page Analytics
- **Focus**: Visitor statistics, engagement
- **Events**: Page views, CTA clicks, navigation
- **Metrics**: Traffic, bounce rate, time on page
- **Goal**: Drive users to chat app

### Chat App Analytics
- **Focus**: User behavior, feature usage
- **Events**: Messages sent, logins, follow-ups
- **Metrics**: Active users, messages per session, retention
- **Goal**: Measure product engagement

### Combined Value
The unified Firebase project gives you the **complete funnel**:
1. Landing page visit
2. Interest (CTA click)
3. Action (navigate to chat)
4. Engagement (send message)
5. Retention (return visits)

## Summary

✅ **Simple Setup**: Just add Firebase config  
✅ **Auto-Tracking**: Page views and CTAs tracked automatically  
✅ **Privacy-First**: No PII collected  
✅ **Unified Dashboard**: Same Firebase project as chat app  
✅ **Production-Only**: Disabled in local development  

For detailed Firebase setup, see: `docs/GOOGLE-ANALYTICS-SETUP.md`

# Mobile Scrolling Fix

## Issue
Chat UI was not scrollable on mobile devices, specifically:
1. **Welcome Screen**: Not scrollable when user first visits the page
2. **Chat Messages**: Only scrollable after first message was sent

## Root Causes

### 1. Welcome Screen Not Scrollable
- `.welcome-screen` used `display: flex` with `align-items: center` and `justify-content: center`
- No `overflow-y: auto` property
- Missing mobile touch scrolling optimization
- Content would overflow viewport but couldn't be scrolled

### 2. General Mobile Layout Issues
- Fixed `body` with `overflow: hidden` but missing proper dimensions
- Missing iOS-specific touch scrolling properties
- No dynamic viewport height support for mobile browsers
- Flexbox children expanding beyond container due to missing `min-height: 0`

## Solutions Applied

### CSS Changes to `app/css/styles.css`

#### 1. Body Element (Fixed Positioning for Mobile)
```css
body {
    position: fixed;
    width: 100%;
    height: 100%;
    overflow: hidden;
    -webkit-overflow-scrolling: touch;
}
```
**Why**: Prevents iOS Safari's bouncing scroll and ensures proper viewport control

#### 2. Main Container (Dynamic Viewport Height)
```css
.main-container {
    height: calc(100vh - 64px);
    height: calc(100dvh - 64px); /* Dynamic viewport height for mobile */
    min-height: 0;
    overflow: hidden;
}
```
**Why**: `100dvh` accounts for mobile browser UI that shows/hides when scrolling

#### 3. Chat Container (Proper Flexbox)
```css
.chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    position: relative;
}
```
**Why**: `min-height: 0` prevents flex children from expanding beyond container

#### 4. Welcome Screen (Enable Scrolling)
```css
.welcome-screen {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
    align-items: flex-start; /* Changed from center on mobile */
}
```
**Why**: 
- `overflow-y: auto` enables vertical scrolling
- `-webkit-overflow-scrolling: touch` enables smooth momentum scrolling on iOS
- `align-items: flex-start` on mobile prevents content from being centered (allows scroll from top)

#### 5. Messages Container (Touch Optimization)
```css
.messages-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
}
```
**Why**: Same as welcome screen - enables smooth scrolling for chat messages

#### 6. Mobile-Specific Fixes
```css
@media (max-width: 768px) {
    .messages-container {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
    }
    
    .chat-container {
        touch-action: pan-y;
    }
    
    .welcome-screen {
        align-items: flex-start;
        padding: 1.5rem 1rem;
    }
}
```
**Why**:
- `overscroll-behavior: contain` prevents overscroll from affecting parent elements
- `touch-action: pan-y` allows vertical scrolling while preventing unwanted gestures
- Top-aligned welcome content on mobile for better scroll behavior

### HTML Changes to `app/index.html`

#### Enhanced Viewport Meta Tags
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
```
**Why**:
- `maximum-scale=1.0, user-scalable=no` prevents iOS zoom on input focus (which causes layout shifts)
- PWA meta tags for better mobile app behavior

## Key CSS Properties Explained

### `-webkit-overflow-scrolling: touch`
- Enables momentum-based scrolling on iOS devices
- Provides native-feeling scroll physics
- Critical for smooth mobile UX

### `overscroll-behavior: contain`
- Prevents scroll chaining (when one scrollable area hits its limit, parent doesn't scroll)
- Keeps scroll within the intended container
- Prevents iOS "rubber band" effect from affecting layout

### `min-height: 0` on Flex Children
- Flexbox children have default `min-height: auto`
- This can cause them to expand beyond container
- Setting `min-height: 0` allows proper overflow behavior

### `100dvh` vs `100vh`
- `100vh` is static and doesn't account for browser UI
- `100dvh` (dynamic viewport height) adjusts when mobile browser UI shows/hides
- Using both provides fallback for older browsers

### `touch-action: pan-y`
- Controls which touch gestures are allowed
- `pan-y` allows vertical panning (scrolling)
- Prevents horizontal gestures and multi-touch that could interfere

## Testing Checklist

On mobile device (or browser dev tools mobile emulation):

- [ ] Welcome screen scrolls smoothly on first visit
- [ ] Can scroll through all example questions
- [ ] Welcome features visible without overflow
- [ ] After sending message, chat messages scroll smoothly
- [ ] Keyboard opening doesn't break layout
- [ ] Scrolling has momentum (iOS)
- [ ] No horizontal scroll
- [ ] Works in both portrait and landscape
- [ ] No unwanted zoom when tapping input field

## Browser Compatibility

### iOS Safari (Primary Focus)
✅ All features supported
- Momentum scrolling works
- Dynamic viewport height supported (iOS 15+)
- Touch action supported

### Chrome Mobile
✅ All features supported
- Standard scrolling behavior
- Touch optimizations work

### Firefox Mobile
✅ All features supported
- May not support `100dvh` on older versions (falls back to `100vh`)

### Samsung Internet
✅ All features supported
- Similar to Chrome Mobile

## Performance Considerations

1. **Hardware Acceleration**
   - `-webkit-overflow-scrolling: touch` uses GPU acceleration
   - Smoother scrolling but slightly more battery usage

2. **Repaints**
   - `position: fixed` on body reduces repaints during scroll
   - `overscroll-behavior: contain` prevents unnecessary parent redraws

3. **Layout Shifts**
   - Fixed viewport meta tags prevent zoom-induced layout shifts
   - `100dvh` eliminates layout jumps when browser UI appears/disappears

## Common Mobile Scrolling Issues (Now Fixed)

| Issue | Cause | Solution |
|-------|-------|----------|
| Welcome screen not scrollable | Missing `overflow-y: auto` | Added overflow and touch scrolling |
| Content stuck at bottom | `align-items: center` in flex | Changed to `flex-start` on mobile |
| Jerky scrolling on iOS | Missing momentum scroll | Added `-webkit-overflow-scrolling: touch` |
| Scroll jumps when typing | Input focus causes zoom | Added `maximum-scale=1.0, user-scalable=no` |
| Rubber band effect | iOS default behavior | Added `overscroll-behavior: contain` |
| Content overflow hidden | Flexbox default min-height | Added `min-height: 0` to containers |
| Height jumps on scroll | Static `100vh` | Added `100dvh` for dynamic viewport |

## Deployment

These changes are purely CSS/HTML and don't require any backend updates.

### Local Testing
```bash
cd docker
docker-compose down
docker-compose up -d --build
```
Access: http://localhost:8081

### Production Deployment
```bash
./scripts/azure-deploy-chat.sh --update
```

## Related Files

- `app/css/styles.css` - All CSS fixes
- `app/index.html` - Viewport meta tags
- `docs/ENVIRONMENT-CONFIGURATION.md` - Build configuration
- `docs/DUAL-APP-DEPLOYMENT.md` - Deployment guide

## Additional Resources

- [MDN: overscroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)
- [MDN: -webkit-overflow-scrolling](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-overflow-scrolling)
- [CSS Tricks: Flexbox min-height](https://css-tricks.com/flexbox-truncated-text/)
- [Web.dev: Dynamic viewport units](https://web.dev/viewport-units/)

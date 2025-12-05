# useMediaQuery Hook - Better Mobile Detection

## Overview
Created a custom React hook for detecting viewport size using `matchMedia` API instead of `window.innerWidth`. This provides a more reliable, reactive, and maintainable way to check if the user is on a mobile device.

## Problem with `window.innerWidth`
Previously, the code used `window.innerWidth < 1024` to detect mobile devices:

```typescript
// Old approach - NOT reactive
if (window.innerWidth < 1024) {
  setSidebarOpen(false);
}
```

**Issues**:
1. ❌ **Not reactive** - Doesn't update when window is resized
2. ❌ **Inconsistent** - Doesn't match Tailwind's breakpoint system
3. ❌ **Not reusable** - Magic number `1024` repeated throughout code
4. ❌ **Timing issues** - `innerWidth` can be inaccurate during hydration/SSR
5. ❌ **Not testable** - Hard to mock in tests

## Solution: useMediaQuery Hook

Created a custom hook that uses the native `matchMedia` API:

### File: `app-react/src/hooks/useMediaQuery.ts`

```typescript
import { useState, useEffect } from 'react';

/**
 * Custom hook to check if a media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

/**
 * Hook to check if viewport is desktop (≥ 1024px, Tailwind 'lg' breakpoint)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/**
 * Hook to check if viewport is mobile (< 1024px)
 */
export function useIsMobile(): boolean {
  return !useIsDesktop();
}
```

## Benefits

### ✅ Reactive
The hook automatically updates when the viewport size changes:
```typescript
const isMobile = useIsMobile(); // Updates on resize!
```

### ✅ Matches Tailwind Breakpoints
Uses the exact same breakpoint as Tailwind's `lg:` classes (1024px):
- CSS: `lg:hidden` = `@media (min-width: 1024px)`
- Hook: `useIsMobile()` = `!(min-width: 1024px)`

### ✅ Reusable
Single source of truth for mobile detection:
```typescript
// ChatPage.tsx
const isMobile = useIsMobile();

// ChatSidebar.tsx
const isMobile = useIsMobile();

// Any component can use it!
```

### ✅ SSR Safe
Handles server-side rendering gracefully:
```typescript
if (typeof window !== 'undefined') {
  return window.matchMedia(query).matches;
}
return false; // Safe default
```

### ✅ Testable
Easy to mock in tests by mocking `window.matchMedia`.

## Usage Examples

### Basic Usage
```typescript
import { useIsMobile, useIsDesktop } from '@/hooks/useMediaQuery';

function MyComponent() {
  const isMobile = useIsMobile();
  
  return (
    <div>
      {isMobile ? (
        <MobileLayout />
      ) : (
        <DesktopLayout />
      )}
    </div>
  );
}
```

### Custom Media Query
```typescript
import { useMediaQuery } from '@/hooks/useMediaQuery';

function MyComponent() {
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const isPortrait = useMediaQuery('(orientation: portrait)');
  
  return <div>...</div>;
}
```

### Conditional Logic
```typescript
const isMobile = useIsMobile();

const handleAction = () => {
  // Close sidebar on mobile
  if (isMobile) {
    setSidebarOpen(false);
  }
};
```

## Implementation in App

### ChatPage.tsx
```typescript
import { useIsMobile } from '@/hooks/useMediaQuery';

export function ChatPage() {
  const isMobile = useIsMobile();
  
  const handleCreateConversation = async () => {
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      if (isMobile) {  // Instead of window.innerWidth < 1024
        setSidebarOpen(false);
      }
      return;
    }
    // ...
  };
}
```

### ChatSidebar.tsx
```typescript
import { useIsMobile } from '@/hooks/useMediaQuery';

export function ChatSidebar({ onSelectConversation, onClose, ... }) {
  const isMobile = useIsMobile();
  
  return (
    <ConversationList
      onSelectConversation={(id) => {
        onSelectConversation(id);
        if (isMobile) {  // Instead of window.innerWidth < 1024
          onClose();
        }
      }}
    />
  );
}
```

## Technical Details

### How matchMedia Works
```typescript
const mediaQuery = window.matchMedia('(min-width: 1024px)');

// Check current state
mediaQuery.matches; // true or false

// Listen for changes
mediaQuery.addEventListener('change', (event) => {
  console.log('Changed to:', event.matches);
});
```

### Event Listener Lifecycle
1. **Mount**: Create media query listener
2. **Change**: Update state when viewport changes
3. **Unmount**: Clean up listener (prevent memory leaks)

### Browser Support
Supported in all modern browsers:
- Chrome ✅
- Firefox ✅
- Safari ✅
- Edge ✅
- Mobile browsers ✅

## Comparison

### Before (window.innerWidth)
```typescript
// ❌ Not reactive - won't update on resize
if (window.innerWidth < 1024) {
  setSidebarOpen(false);
}

// ❌ Repeated magic number
if (window.innerWidth < 1024) { ... }
if (window.innerWidth < 1024) { ... }
```

### After (useMediaQuery hook)
```typescript
// ✅ Reactive - updates automatically
const isMobile = useIsMobile();

if (isMobile) {
  setSidebarOpen(false);
}

// ✅ Consistent and reusable
if (isMobile) { ... }
if (isMobile) { ... }
```

## Tailwind Breakpoints Reference

For future use, here are all Tailwind breakpoints:

```typescript
// Tailwind breakpoints
export function useIsMobile() {
  return !useMediaQuery('(min-width: 1024px)'); // < lg
}

export function useIsTablet() {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)'); // md to lg
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)'); // >= lg
}

export function useIsWidescreen() {
  return useMediaQuery('(min-width: 1280px)'); // >= xl
}
```

## Files Modified

1. **Created**: `app-react/src/hooks/useMediaQuery.ts`
   - `useMediaQuery(query)` - Generic media query hook
   - `useIsDesktop()` - Desktop detection (≥ 1024px)
   - `useIsMobile()` - Mobile detection (< 1024px)

2. **Updated**: `app-react/src/pages/ChatPage.tsx`
   - Imported `useIsMobile()`
   - Replaced `window.innerWidth < 1024` with `isMobile`
   - Used in `handleCreateConversation()`

3. **Updated**: `app-react/src/components/chat/ChatSidebar.tsx`
   - Imported `useIsMobile()`
   - Replaced `window.innerWidth < 1024` with `isMobile`
   - Used in conversation selection handler

## Testing

Build succeeded with no errors! ✅

The hook is now being used in:
- Sidebar auto-close on mobile
- New chat button behavior
- Conversation selection

## Future Enhancements

This hook can be extended for:
- Orientation detection: `useIsPortrait()`
- Touch device detection: `useHasTouch()`
- Dark mode detection: `usePrefersDarkMode()`
- Reduced motion: `usePrefersReducedMotion()`
- High contrast: `usePrefersHighContrast()`

## Resources

- [MDN: Window.matchMedia()](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)
- [Tailwind Breakpoints](https://tailwindcss.com/docs/responsive-design)
- [React Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)

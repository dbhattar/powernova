# Mobile Sidebar Toggle Feature

## Problem
The chat sidebar was collapsing by default on mobile devices (as designed), but there was no way for users to open it again. The toggle button was only visible on desktop screens (`hidden lg:flex`), leaving mobile users unable to access their conversation history or create new conversations.

## Solution
Added a hamburger menu button in the Header component that appears only on mobile devices and allows users to toggle the chat sidebar.

## Implementation

### 1. Updated Header Component
**File**: `app-react/src/components/Header.tsx`

Added:
- Import `Menu` icon from `lucide-react`
- Optional `onMenuClick` prop to the `HeaderProps` interface
- Hamburger menu button that:
  - Only shows on mobile (`lg:hidden`)
  - Only appears in chat variant
  - Positioned to the left of the logo
  - Triggers the `onMenuClick` callback when clicked

```tsx
interface HeaderProps {
  variant: 'chat' | 'search' | 'profile';
  onMenuClick?: () => void;  // New prop
}

// Hamburger menu button (mobile only)
{variant === 'chat' && onMenuClick && (
  <button
    onClick={onMenuClick}
    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
    aria-label="Toggle sidebar"
  >
    <Menu className="w-5 h-5 text-gray-600" />
  </button>
)}
```

### 2. Updated ChatPage Component
**File**: `app-react/src/pages/ChatPage.tsx`

Connected the Header's menu button to the sidebar state:

```tsx
<Header variant="chat" onMenuClick={() => setSidebarOpen(true)} />
```

When clicked, this sets `sidebarOpen` to `true`, which triggers the sidebar to slide in from the left.

### 3. Existing Sidebar Behavior (Unchanged)
**File**: `app-react/src/components/chat/ChatSidebar.tsx`

The sidebar already had the correct mobile behavior:
- Overlay background when open on mobile
- Slide-in animation from the left
- Auto-close when selecting a conversation
- Close button (X) in the sidebar header
- Click outside to close (via overlay)

## User Experience

### Mobile (< 1024px)
1. **Default state**: Sidebar is hidden
2. **User clicks hamburger menu** in top-left of header
3. **Sidebar slides in** from the left with overlay background
4. **User can**:
   - View all conversations
   - Select a conversation (sidebar auto-closes)
   - Create new conversation
   - Rename/delete conversations
   - Click X button to close
   - Click outside sidebar to close

### Desktop (≥ 1024px)
- Hamburger menu button is hidden
- Sidebar uses existing toggle button (chevron on right edge)
- Sidebar can be collapsed to save screen space
- No overlay when sidebar is open

## Technical Details

### CSS Classes Used
- `lg:hidden` - Hide on large screens (desktop)
- `transition-colors` - Smooth hover effect
- `p-2` - Padding for touch target
- `hover:bg-gray-100` - Hover state

### Accessibility
- `aria-label="Toggle sidebar"` - Screen reader support
- Proper button element for keyboard navigation
- Visual feedback on hover

### Responsive Breakpoint
- Uses Tailwind's `lg` breakpoint (1024px)
- Consistent with existing sidebar responsive behavior

## Testing Checklist
- [ ] Hamburger button visible on mobile (< 1024px)
- [ ] Hamburger button hidden on desktop (≥ 1024px)
- [ ] Clicking hamburger opens sidebar
- [ ] Sidebar slides in with animation
- [ ] Overlay appears behind sidebar
- [ ] Clicking outside closes sidebar
- [ ] Clicking X button closes sidebar
- [ ] Selecting conversation closes sidebar
- [ ] Desktop toggle button still works
- [ ] No console errors

## Files Modified
1. `app-react/src/components/Header.tsx`
   - Added `Menu` icon import
   - Added `onMenuClick` prop
   - Added hamburger button (mobile only)

2. `app-react/src/pages/ChatPage.tsx`
   - Connected `onMenuClick` to `setSidebarOpen(true)`

## Related Components
- `ChatSidebar.tsx` - Existing sidebar with mobile overlay
- `ConversationList.tsx` - Conversation list inside sidebar
- `Header.tsx` - Main header with new hamburger button

## Future Enhancements
- Add animation to hamburger icon (transform to X when open)
- Consider adding swipe gesture to open/close sidebar
- Add keyboard shortcut (e.g., Cmd+\ to toggle sidebar)

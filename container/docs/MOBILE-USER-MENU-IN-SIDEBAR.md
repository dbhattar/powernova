# Mobile User Menu in Sidebar

## Overview
Moved the user menu (profile and logout) from the header to the sidebar on mobile devices to save space in the header and provide a better mobile UX. On desktop, the user menu remains in the header.

## Problem
On mobile devices, the header was becoming crowded with:
- Hamburger menu button
- Logo and branding
- Search button (chat page)
- User menu icon

This created a cramped experience, especially on smaller screens.

## Solution
Implemented responsive design where:
- **Mobile (< 1024px)**: User menu appears at the bottom of the sidebar
- **Desktop (≥ 1024px)**: User menu remains in the header (unchanged)

## Implementation

### 1. Updated ChatSidebar Component
**File**: `app-react/src/components/chat/ChatSidebar.tsx`

**Added Props**:
```typescript
interface ChatSidebarProps {
  // ... existing props
  user?: { username: string; email: string } | null;
  onLogout?: () => void;
}
```

**Added User Menu Section** (at bottom of sidebar):
```tsx
{/* User menu - Mobile only, at the bottom */}
{user && (
  <div className="lg:hidden border-t border-gray-200 bg-gray-50 mt-auto">
    <div className="p-3">
      <div className="px-3 py-2 mb-2">
        <p className="text-sm font-medium text-gray-900">{user.username}</p>
        <p className="text-xs text-gray-500 truncate">{user.email}</p>
      </div>
      <Link
        to="/profile"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <User className="w-4 h-4" />
        <span>My Profile</span>
      </Link>
      <button
        onClick={() => {
          onLogout?.();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
      >
        <LogOut className="w-4 h-4" />
        <span>Logout</span>
      </button>
    </div>
  </div>
)}
```

**Key Features**:
- `lg:hidden` - Only visible on mobile
- `mt-auto` - Pushes to bottom of sidebar
- `border-t` - Visual separation from conversation list
- Auto-closes sidebar after clicking profile or logout
- Uses Lucide icons for consistency

### 2. Updated Header Component
**File**: `app-react/src/components/Header.tsx`

**Modified User Menu Container**:
```tsx
<div className={`relative ${variant === 'chat' ? 'hidden lg:block' : ''}`}>
  {/* User menu dropdown */}
</div>
```

**Behavior**:
- Chat page: Hidden on mobile (`hidden lg:block`), visible on desktop
- Search/Profile pages: Always visible (unchanged)

### 3. Updated ChatPage Component
**File**: `app-react/src/pages/ChatPage.tsx`

**Pass User Data to Sidebar**:
```tsx
const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();

<ChatSidebar
  // ... existing props
  user={user}
  onLogout={logout}
/>
```

## User Experience

### Mobile Flow (< 1024px)
1. User taps **hamburger menu** in header
2. Sidebar slides in from left
3. User sees:
   - Conversations at top
   - User info at bottom (username, email)
   - "My Profile" link
   - "Logout" button
4. Tapping profile navigates to `/profile` and closes sidebar
5. Tapping logout logs out and closes sidebar

### Desktop Flow (≥ 1024px)
1. User menu remains in header (unchanged)
2. Click user icon to open dropdown
3. Same options: Profile, Logout
4. Sidebar user menu is hidden (`lg:hidden`)

## Visual Design

### Mobile Sidebar User Menu
```
┌─────────────────────────┐
│  Conversations          │
│  - Chat 1               │
│  - Chat 2               │
│                         │
├─────────────────────────┤ ← Border separator
│  👤 username            │
│     user@email.com      │
│                         │
│  👤  My Profile         │
│  🚪  Logout             │
└─────────────────────────┘
```

### Styling Details
- **Background**: `bg-gray-50` for subtle distinction
- **Border**: `border-t border-gray-200` for separation
- **User info**: Slightly darker background, truncated email
- **Buttons**: Hover states with rounded corners
- **Logout**: Red text (`text-red-600`) for emphasis
- **Icons**: Lucide icons (User, LogOut) for modern look

## Benefits

### Mobile
✅ Cleaner header - less crowded  
✅ Easier thumb reach (bottom of sidebar)  
✅ Consistent with native app patterns  
✅ More space for logo and search  

### Desktop
✅ Unchanged behavior - familiar UX  
✅ Quick access from header  
✅ No navigation required  

### Code
✅ Responsive without duplicating components  
✅ Shared user data via props  
✅ Consistent styling  
✅ Single source of truth for auth state  

## Responsive Breakpoints
- **Mobile**: `< 1024px` (Tailwind `lg` breakpoint)
- **Desktop**: `≥ 1024px`

This matches the existing sidebar responsive behavior.

## Testing Checklist
- [ ] Mobile: User menu appears in sidebar
- [ ] Mobile: User menu hidden in header
- [ ] Desktop: User menu appears in header
- [ ] Desktop: User menu hidden in sidebar
- [ ] Profile link navigates correctly
- [ ] Logout button works
- [ ] Sidebar closes after clicking profile/logout
- [ ] User info displays correctly (username, email)
- [ ] Icons render properly
- [ ] Hover states work
- [ ] Build succeeds without errors

## Files Modified
1. `app-react/src/components/chat/ChatSidebar.tsx`
   - Added `user` and `onLogout` props
   - Added mobile-only user menu section at bottom
   - Imported `User`, `LogOut` icons from lucide-react
   - Imported `Link` from react-router-dom

2. `app-react/src/components/Header.tsx`
   - Added conditional `hidden lg:block` to user menu for chat variant
   - Keeps user menu visible on search/profile pages

3. `app-react/src/pages/ChatPage.tsx`
   - Destructured `user` and `logout` from `useAuth()`
   - Passed `user` and `onLogout` props to `ChatSidebar`

## Related Features
- Mobile hamburger menu (already implemented)
- Sidebar toggle button (desktop)
- Header navigation (search, profile links)
- Login/logout flow

## Future Enhancements
- Add user avatar/profile picture
- Show user role/subscription status
- Add settings link in mobile menu
- Add keyboard shortcut hints
- Add "Switch Account" option for multi-account support

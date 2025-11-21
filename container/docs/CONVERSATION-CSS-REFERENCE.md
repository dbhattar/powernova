# Conversation Management - CSS Reference

## 🎨 New CSS Classes Added

This document lists all new CSS classes added for the conversation management feature.

---

## Conversations Sidebar

### Container
```css
.conversations-sidebar         /* Main sidebar container (300px width) */
.conversations-sidebar.collapsed  /* Hidden state (translateX(-100%)) */
```

### Header
```css
.btn-new-conversation         /* "New Conversation" button with gradient */
```

### Conversation List
```css
.conversations-list           /* Scrollable list container */
.conversations-empty          /* Empty state placeholder */
```

### Conversation Items
```css
.conversation-item            /* Individual conversation card */
.conversation-item.active     /* Active conversation (gradient background) */
.conversation-item:hover      /* Hover state */

.conversation-header          /* Title + action buttons container */
.conversation-title           /* Conversation title text */
.conversation-actions         /* Action buttons container (rename, delete) */

.btn-conversation-action      /* Generic action button */
.btn-conversation-action.delete:hover  /* Delete button hover (red) */

.conversation-meta            /* Metadata container */
.conversation-timestamp       /* Time display ("Just now", "5m ago") */
.conversation-preview         /* Last message preview */
.conversation-stats           /* Messages/documents count container */

.stat-badge                   /* Individual stat (messages, docs count) */
.stat-badge i                 /* Icon in stat badge */
```

### Sidebar Toggle
```css
.sidebar-toggle               /* Toggle button on sidebar edge */
.sidebar-toggle:hover         /* Hover state (purple) */
```

---

## Documents Panel

### Container
```css
.documents-panel              /* Right-side sliding panel (320px) */
.documents-panel:not([style*="display: none"])  /* Visible state */
```

### Header
```css
.documents-panel-header       /* Panel header with title */
.btn-close-panel              /* Close button (×) */
```

### Content
```css
.documents-content            /* Scrollable documents list */
.documents-empty              /* Empty state when no docs */
```

### Document Items
```css
.document-item                /* Individual document card */
.document-item:hover          /* Hover state (border + shadow) */

.document-header              /* Icon + info + actions */
.document-icon                /* File type icon (40x40) */
.document-icon.pdf            /* PDF icon (red) */
.document-icon.docx           /* DOCX icon (blue) */
.document-icon.txt            /* TXT icon (green) */
.document-icon.md             /* Markdown icon (green) */

.document-info                /* Filename + metadata */
.document-name                /* Document filename */
.document-meta                /* File size, upload time */

.document-actions             /* Action buttons (delete) */
.btn-document-action          /* Generic action button */
.btn-document-action.delete:hover  /* Delete hover (red) */

.document-footer              /* Status badge container */
```

---

## Status Badges

```css
.status-badge                 /* Base status badge */
.status-badge.completed       /* Green badge (ready) */
.status-badge.processing      /* Yellow badge (in progress) */
.status-badge.failed          /* Red badge (error) */
.status-badge.pending         /* Blue badge (waiting) */
```

---

## Input Area Additions

```css
.btn-documents                /* Documents panel toggle button */
.btn-documents.active         /* Active state (purple color) */

.document-badge               /* Red notification badge with count */

.btn-upload                   /* File upload button (paperclip) */
.btn-upload:hover             /* Hover state (purple) */

#fileInput                    /* Hidden file input (display: none) */
```

---

## Modals

### Rename Modal
```css
.modal-small                  /* Smaller modal (max-width: 450px) */
.rename-form                  /* Rename form container */
.modal-actions                /* Button container (Save/Cancel) */
.btn-secondary                /* Cancel/secondary action button */
```

### Upload Progress Modal
```css
.upload-progress              /* Upload progress container */
.upload-filename              /* Filename being uploaded */

.progress-bar                 /* Progress bar container */
.progress-fill                /* Animated fill (gradient) */
.progress-text                /* Percentage text */
```

---

## Source Badges (in Messages)

```css
.source-badge                 /* Base source badge */
.source-badge.badge-platform  /* Platform doc (blue) */
.source-badge.badge-uploaded  /* User uploaded (yellow) */
```

---

## Responsive Breakpoints

### Tablet (max-width: 1024px)
```css
.conversations-sidebar { width: 280px; }
.documents-panel { width: 300px; }
```

### Mobile (max-width: 768px)
```css
.conversations-sidebar {
  /* Absolute overlay, 85% width, max 300px */
  position: absolute;
  z-index: 100;
  box-shadow: var(--shadow-xl);
}

.documents-panel {
  width: 100%;  /* Full width on mobile */
}

.sidebar-toggle {
  display: none;  /* Hidden on mobile */
}
```

### Small Mobile (max-width: 480px)
```css
.conversations-sidebar {
  width: 90%;  /* Almost full width */
}

/* Smaller font sizes and padding */
.conversation-title { font-size: 0.875rem; }
.document-icon { width: 36px; height: 36px; }
```

---

## Color Variables Used

### Status Colors
```css
--success-color: #10b981;   /* Green for completed */
--warning-color: #f59e0b;   /* Yellow for processing */
--danger-color: #ef4444;    /* Red for failed/delete */
--primary-color: #667eea;   /* Purple for active states */
--secondary-color: #764ba2; /* Secondary purple for gradients */
```

### Background Colors
```css
--bg-primary: #ffffff;      /* White backgrounds */
--bg-secondary: #f9fafb;    /* Light gray backgrounds */
--bg-tertiary: #f3f4f6;     /* Slightly darker gray */
```

### Text Colors
```css
--text-primary: #111827;    /* Dark text */
--text-secondary: #6b7280;  /* Medium gray text */
--text-tertiary: #9ca3af;   /* Light gray text */
```

### Border Colors
```css
--border-color: #e5e7eb;    /* Default border */
--border-light: #f3f4f6;    /* Lighter border */
```

---

## Gradients

### Primary Gradient (Active States)
```css
background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
/* #667eea → #764ba2 */
```

### Progress Bar Gradient
```css
background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
/* Horizontal gradient */
```

---

## Transitions & Animations

### Slide Transitions
```css
transition: transform 0.3s ease;
```

### Hover Transitions
```css
transition: var(--transition);  /* all 0.3s ease */
```

### Transform States
```css
/* Hidden sidebar */
transform: translateX(-100%);

/* Visible sidebar */
transform: translateX(0);

/* Hidden documents panel */
transform: translateX(100%);
```

---

## Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

---

## Border Radius

```css
--radius-sm: 0.375rem;  /* 6px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-xl: 1rem;      /* 16px */
```

---

## Usage Examples

### Creating an Active Conversation
```html
<div class="conversation-item active">
  <div class="conversation-header">
    <div class="conversation-title">Renewable Energy</div>
    <div class="conversation-actions">
      <button class="btn-conversation-action">✏️</button>
      <button class="btn-conversation-action delete">🗑️</button>
    </div>
  </div>
  <div class="conversation-meta">
    <span class="conversation-timestamp">
      <i class="fas fa-clock"></i> 5m ago
    </span>
    <span class="conversation-preview">Tell me about solar panels</span>
  </div>
  <div class="conversation-stats">
    <span class="stat-badge">
      <i class="fas fa-message"></i> 4
    </span>
    <span class="stat-badge">
      <i class="fas fa-file"></i> 2
    </span>
  </div>
</div>
```

### Creating a Document Item
```html
<div class="document-item">
  <div class="document-header">
    <div class="document-icon pdf">
      <i class="fas fa-file-pdf"></i>
    </div>
    <div class="document-info">
      <div class="document-name">solar-research.pdf</div>
      <div class="document-meta">
        <span>2.4 MB</span>
        <span>Uploaded 10m ago</span>
      </div>
    </div>
    <div class="document-actions">
      <button class="btn-document-action delete">🗑️</button>
    </div>
  </div>
  <div class="document-footer">
    <span class="status-badge completed">
      <i class="fas fa-check"></i> Completed
    </span>
  </div>
</div>
```

### Status Badge Variations
```html
<!-- Completed -->
<span class="status-badge completed">
  <i class="fas fa-check"></i> Completed
</span>

<!-- Processing -->
<span class="status-badge processing">
  <i class="fas fa-spinner"></i> Processing
</span>

<!-- Failed -->
<span class="status-badge failed">
  <i class="fas fa-exclamation-circle"></i> Failed
</span>

<!-- Pending -->
<span class="status-badge pending">
  <i class="fas fa-clock"></i> Pending
</span>
```

---

## Customization

### Changing Sidebar Width
```css
.conversations-sidebar {
  width: 350px;  /* Default: 300px */
}
```

### Changing Documents Panel Width
```css
.documents-panel {
  width: 400px;  /* Default: 320px */
}
```

### Changing Active Color
```css
:root {
  --primary-color: #ff6b6b;  /* Red instead of purple */
  --secondary-color: #ff8787;
}
```

### Changing Status Colors
```css
.status-badge.completed {
  background: #60a5fa;  /* Blue instead of green */
  color: #1e3a8a;
}
```

---

## Browser Compatibility

✅ **Chrome/Edge**: Full support  
✅ **Firefox**: Full support  
✅ **Safari**: Full support (uses -webkit-prefixes where needed)  
✅ **Mobile Safari**: Full support with touch-friendly tap targets  
✅ **Chrome Mobile**: Full support  

### Known Issues
- None currently identified

---

## Accessibility

### ARIA Labels (Recommended Additions)
```html
<button class="btn-new-conversation" aria-label="Create new conversation">
  <i class="fas fa-plus"></i> New Conversation
</button>

<button class="btn-conversation-action delete" aria-label="Delete conversation">
  <i class="fas fa-trash"></i>
</button>

<button class="btn-document-action delete" aria-label="Delete document">
  <i class="fas fa-trash"></i>
</button>
```

### Focus States
All interactive elements have focus states defined:
```css
.btn-conversation-action:focus,
.btn-document-action:focus,
.btn-new-conversation:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
```

---

## Performance Optimizations

### GPU Acceleration
Transforms use GPU acceleration for smooth animations:
```css
transform: translateX(-100%);  /* GPU accelerated */
```

### Will-Change
For frequently animated elements:
```css
.conversations-sidebar,
.documents-panel {
  will-change: transform;
}
```

---

**Last Updated**: 2024-11-16  
**Version**: 1.0.0  
**Author**: PowerNOVA Development Team

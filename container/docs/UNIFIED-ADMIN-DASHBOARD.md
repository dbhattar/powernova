# Unified Admin Dashboard - Complete Guide

## Overview

The PowerNOVA Admin Dashboard provides a **single, unified interface** for managing all aspects of the system:

- 📊 **Overview** - System statistics and quick actions
- 🕷️ **Crawl Management** - Web crawler jobs and documents
- 🧠 **Embedding Management** - Document chunking and reprocessing
- 👥 **User Management** - User accounts and permissions

## Access

### URL
```
http://localhost:8080/admin.html
```

### Authentication
You'll be prompted for the admin key on first access:
```
Admin Key: wMQj71sVPJ/P7u2IyGRQCdP5kA+HXlfklFxvoUBk5k0=
```

The key is stored in `localStorage` and persists across sessions.

## Features

### 📊 Overview Tab

**Purpose**: System-wide dashboard with key metrics

**Statistics Displayed**:
- **Crawl Jobs**: Total and running count
- **Documents**: Total documents in system
- **Embeddings**: Documents with embeddings
- **Chunks**: Total document chunks (new system)
- **Migration Progress**: % of documents migrated to chunks
- **Users**: Total and active user counts

**Visual Features**:
- Real-time stats cards
- Migration progress bar
- Quick action buttons to jump to other tabs

**Use Cases**:
- Check system health at a glance
- Monitor embedding migration progress
- Quick access to key admin functions

---

### 🕷️ Crawl Management Tab

**Purpose**: Manage web crawler jobs

**Features**:

#### Statistics
- Total crawl jobs
- Running jobs (active crawlers)
- Completed jobs
- Failed jobs

#### Crawl Jobs Table
Displays all crawl jobs with:
- **ID** - Unique job identifier
- **Start URL** - Root URL being crawled
- **Status** - PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- **Pages Crawled** - Number of pages visited
- **Documents Found** - Number of documents extracted
- **Started At** - Job start timestamp
- **Actions** - Cancel (for running) or Delete (for completed/failed)

#### Create New Crawl Job
Click "➕ New Crawl Job" to open the creation modal:

**Fields**:
- **Start URL** (required): Root URL to begin crawling
  - Example: `https://www.ferc.gov`
- **Max Depth**: How deep to crawl (0 = only start URL)
  - Default: 2
  - Range: 0-10
- **Max Pages**: Maximum pages to visit
  - Default: 100
  - Range: 1-1000
- **Allowed Domains**: Additional domains to crawl (comma-separated)
  - Leave empty to only crawl the same domain as Start URL
  - Example: `ferc.gov, www.ferc.gov, cms.ferc.gov`

**Process**:
1. Click "Create Job"
2. Job starts in background immediately
3. Status updates in real-time
4. Documents are saved to Azure Blob Storage
5. Embeddings are generated automatically (if configured)

#### Managing Jobs

**Cancel a Running Job**:
```
Click "Cancel" → Confirm → Job status changes to CANCELLED
```

**Delete a Completed Job**:
```
Click "Delete" → Confirm → Job and all its documents are deleted
```

⚠️ **Warning**: Deleting a crawl job deletes ALL documents from that job!

---

### 🧠 Embedding Management Tab

**Purpose**: Manage document embeddings and migration to chunking system

**Features**:

#### Statistics
- **Total Documents**: All documents in system
- **With Chunks**: Documents using new chunking system ✅
- **Old Embeddings**: Documents needing reprocessing ⚠️
- **Total Chunks**: Total chunks across all documents

#### Reprocessing Tools

**Test Reprocessing (10 Documents)**:
```
Click "Reprocess 10 Documents (Test)"
→ Processes 10 oldest documents as a test
→ Use this first to verify system works
```

**Batch Reprocessing (All Documents)**:
```
Click "Reprocess All Old Embeddings"
→ Queues ALL documents with old embeddings
→ Runs in background
→ Can take 15-30 minutes for 288 documents
```

**Scope Filter**:
```
Filter by document scope:
- All Scopes (default)
- Platform (crawled documents)
- User (uploaded documents)
- Conversation (conversation-specific docs)
```

#### Documents Table
Shows documents needing reprocessing:

- **ID** - Document identifier
- **Title** - Document title (truncated)
- **Type** - html, pdf, docx, etc.
- **Scope** - platform, user, conversation
- **Size** - File size in KB/MB
- **Status** - "Old Embedding" badge
- **Actions** - ♻️ Reprocess button (per document)

**Single Document Reprocess**:
```
Click ♻️ Reprocess → Confirm
→ Document is queued for reprocessing
→ Old embedding deleted
→ New chunks created with individual embeddings
→ Table refreshes automatically
```

#### How Reprocessing Works

**What Happens**:
1. Old `documents.embedding` is deleted
2. Document content is split into chunks (800 words each, 200 overlap)
3. Each chunk gets its own embedding
4. Chunks stored in `document_chunks` table
5. Document marked as migrated

**Why Reprocess**:
- Old system truncated documents to 4000 words (data loss!)
- New system: unlimited document size
- Better search precision (chunk-level matching)
- No content truncation

**Migration States**:
- ❌ **Old Embedding**: Has single embedding, needs reprocessing
- ✅ **With Chunks**: Migrated to new system
- ⭕ **No Embedding**: Never processed (will use new system automatically)

---

### 👥 User Management Tab

**Purpose**: Manage user accounts and permissions

**Features**:

#### Statistics
- **Total Users**: All registered users
- **Active**: Users with `is_active = true`
- **Inactive**: Deactivated users
- **Super Users**: Users with admin privileges

#### Users Table
Displays all users with:

- **ID** - User identifier
- **Email** - Login email
- **Username** - Display name
- **Status** - Active/Inactive badge
- **Roles** - Admin badge (if superuser), Verified badge
- **Created** - Account creation date
- **Actions** - Activate/Deactivate, Reset Password, Delete

#### Create New User
Click "➕ Create User" to open the creation modal:

**Fields**:
- **Email** (required): User's email address
  - Must be unique
  - Used for login
- **Username** (required): Display name
  - Example: "John Doe"
- **Password** (optional): Set password manually
  - Leave empty to auto-generate
  - Minimum 8 characters if provided
- **Grant Admin Privileges** (checkbox): Make user a superuser
  - Allows access to admin dashboard
  - Can create crawl jobs, manage users, etc.

**Process**:
1. Fill form and click "Create User"
2. If password was auto-generated, it's displayed in an alert
3. ⚠️ **Save the password immediately!** It won't be shown again
4. User receives account with `must_change_password = true`
5. User must change password on first login

**Example**:
```
Email: john@example.com
Username: John Doe
Password: (leave empty)
Admin: ☐ (unchecked)

Result:
→ User created with email john@example.com
→ Temporary Password: xK9mP2nQ7zL5vR8t
→ User must change password on first login
```

#### Managing Users

**Activate/Deactivate User**:
```
Click "Activate" or "Deactivate"
→ Toggles is_active flag
→ Deactivated users cannot log in
→ Useful for temporary suspension
```

**Reset Password**:
```
Click "Reset Password" → Confirm
→ New random password generated
→ Displayed in alert (save it!)
→ User must change password on next login
```

**Delete User**:
```
Click "Delete" → Confirm
→ User account deleted
→ ALL user data deleted:
  - Conversations
  - Uploaded documents
  - Message history
→ PERMANENT - cannot be undone!
```

---

## Common Workflows

### Workflow 1: Create and Monitor Crawl Job

1. **Navigate**: Click "🕷️ Crawl Management" tab
2. **Create**: Click "➕ New Crawl Job"
3. **Configure**:
   ```
   Start URL: https://www.example.com
   Max Depth: 2
   Max Pages: 100
   Allowed Domains: (leave empty)
   ```
4. **Submit**: Click "Create Job"
5. **Monitor**: Watch status change from PENDING → RUNNING → COMPLETED
6. **Verify**: Check "Pages Crawled" and "Documents Found" columns
7. **Test**: Switch to Overview tab to see updated document count

### Workflow 2: Migrate Documents to Chunking System

1. **Check Status**: Navigate to "📊 Overview" tab
2. **View Progress**: Look at "Migration Progress" bar
   - If < 100%, migration needed
3. **Navigate**: Click "🧠 Embeddings" tab
4. **Test First**: Click "Reprocess 10 Documents (Test)"
   - Wait ~30 seconds
   - Click "🔄 Refresh List"
   - Verify 10 documents disappeared from table (now migrated)
5. **Full Migration**: Click "Reprocess All Old Embeddings"
   - Confirm the action
   - Wait 15-30 minutes (for ~300 documents)
6. **Monitor Progress**:
   - Return to Overview tab
   - Watch "Migration Progress" bar increase
   - Refresh page periodically
7. **Verify Complete**: When progress = 100%:
   - Embeddings tab shows "All Documents Migrated!" ✅
   - No documents in "Needs Reprocessing" table

### Workflow 3: Create User and Send Credentials

1. **Navigate**: Click "👥 Users" tab
2. **Create**: Click "➕ Create User"
3. **Fill Form**:
   ```
   Email: newuser@company.com
   Username: New User
   Password: (leave empty for auto-generate)
   Admin: ☑ (if they need admin access)
   ```
4. **Submit**: Click "Create User"
5. **Save Password**: Alert shows:
   ```
   User created: newuser@company.com
   
   Temporary Password: xK9mP2nQ7zL5vR8t
   
   ⚠️ Save this password! It won't be shown again.
   ```
6. **Copy Password**: Copy to clipboard
7. **Send to User**: Email or Slack the credentials:
   ```
   Login URL: https://app.powernova.ai
   Email: newuser@company.com
   Temporary Password: xK9mP2nQ7zL5vR8t
   
   You must change your password on first login.
   ```

### Workflow 4: Investigate Failed Crawl Job

1. **Navigate**: "🕷️ Crawl Management" tab
2. **Identify**: Find job with "FAILED" status badge
3. **Check Details**:
   - Note "Pages Crawled" (if 0, never started)
   - Note "Documents Found" (if 0, no content extracted)
4. **Investigate**: Common issues:
   - **403 Forbidden**: Site blocks crawlers (like FERC.gov with Cloudflare)
   - **Network Errors**: Timeout, DNS failure
   - **Invalid URL**: Start URL doesn't exist
5. **Action Options**:
   - **Delete Failed Job**: Click "Delete"
   - **Retry with Different URL**: Create new job with alternative URL
   - **Contact Support**: If site should be accessible

### Workflow 5: Bulk User Management

**Scenario**: Need to create 10 new users for team

1. **Navigate**: "👥 Users" tab
2. **Prepare Spreadsheet**: Create with columns:
   ```
   Email | Username | Admin
   user1@company.com | Alice Smith | No
   user2@company.com | Bob Jones | No
   admin@company.com | Admin User | Yes
   ```
3. **Create Each User**:
   - Click "➕ Create User"
   - Fill from spreadsheet
   - Leave password empty (auto-generate)
   - Copy temporary password to spreadsheet
4. **Document Passwords**:
   ```
   Email | Username | Temporary Password
   user1@company.com | Alice Smith | xK9mP2nQ7zL5vR8t
   user2@company.com | Bob Jones | mN3pQ6rT9vX2yZ5c
   admin@company.com | Admin User | aB4dF7hK0jM3nP6q
   ```
5. **Send Credentials**: Email each user their credentials
6. **Clean Up**: Securely delete spreadsheet after users change passwords

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Switch to Overview tab |
| `2` | Switch to Crawl Management tab |
| `3` | Switch to Embeddings tab |
| `4` | Switch to Users tab |
| `R` | Refresh current tab |
| `Esc` | Close open modal |

*(To enable: add keyboard event listener to the JavaScript)*

---

## Troubleshooting

### Problem: "Invalid admin key" error

**Solution**:
1. Click "🔑 Change Key" button
2. Enter correct admin key
3. Or check `docs/ADMIN-ACCESS.md` for current key

### Problem: Stats not updating

**Solution**:
1. Click "🔄 Refresh All" button
2. Or switch to another tab and back
3. Or hard refresh: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)

### Problem: Crawl job stuck in "RUNNING"

**Solution**:
1. Wait at least 5 minutes (large sites take time)
2. If truly stuck (30+ minutes):
   - Click "Cancel"
   - Check API logs: `docker logs powernova-api`
   - Create new job with smaller `max_pages`

### Problem: Reprocessing not working

**Solution**:
1. Check if documents are actually being processed:
   ```bash
   docker logs -f powernova-api | grep "Processing embedding"
   ```
2. Verify OpenAI API key is set:
   ```bash
   docker exec powernova-api env | grep OPENAI_API_KEY
   ```
3. Check for errors:
   ```bash
   docker logs powernova-api | grep ERROR | grep embedding
   ```

### Problem: User creation fails

**Possible Causes**:
- Email already exists (must be unique)
- Email format invalid
- Password too short (min 8 characters)

**Solution**:
- Check error message in alert
- Try different email
- Leave password empty for auto-generate

### Problem: Page is slow/unresponsive

**Solution**:
1. Clear browser cache and refresh
2. Check browser console for JavaScript errors (`F12`)
3. Reduce `ITEMS_PER_PAGE` if dealing with large datasets
4. Contact support if issue persists

---

## Performance Considerations

### Crawl Jobs
- Large crawls (1000+ pages) can take 30-60 minutes
- Running multiple crawls simultaneously is supported
- API calls are non-blocking (uses background tasks)

### Embedding Reprocessing
- **Single Document**: ~2-3 seconds
- **10 Documents**: ~20-30 seconds  
- **100 Documents**: ~3-5 minutes
- **300 Documents**: ~15-25 minutes

**Bottlenecks**:
- OpenAI API rate limits
- Document size (larger = more chunks = longer)
- Network latency

**Recommendations**:
- Test with 10 documents first
- Run full reprocessing during off-peak hours
- Monitor progress via Overview tab

### User Management
- Loading 100+ users: ~500ms
- Creating user: ~200ms
- Fast enough for real-time use

---

## API Endpoints Used

The admin dashboard calls these backend APIs:

### Overview
- `GET /api/admin/stats` - All system statistics

### Crawl Management
- `GET /api/admin/crawl?limit=50` - List crawl jobs
- `POST /api/admin/crawl` - Create crawl job
- `POST /api/admin/crawl/{id}/cancel` - Cancel job
- `DELETE /api/admin/crawl/{id}` - Delete job

### Embeddings
- `GET /api/admin/embeddings/stats` - Embedding statistics
- `GET /api/admin/embeddings/documents-needing-reprocessing` - List documents
- `POST /api/admin/embeddings/reprocess-document/{id}` - Reprocess one
- `POST /api/admin/embeddings/reprocess-all` - Batch reprocess

### Users
- `GET /api/admin/users?limit=100` - List users
- `POST /api/admin/users` - Create user
- `PATCH /api/admin/users/{id}/toggle-active` - Activate/deactivate
- `POST /api/admin/users/{id}/reset-password` - Reset password
- `DELETE /api/admin/users/{id}` - Delete user

---

## Security

### Admin Key Storage
- Stored in `localStorage` (browser)
- Persists across sessions
- Can be changed anytime via "🔑 Change Key" button

### HTTPS Requirement
In production, **always** access admin dashboard via HTTPS:
```
https://app.powernova.ai/admin.html
```

Never use HTTP in production (admin key visible in network traffic).

### User Password Security
- Passwords are hashed with bcrypt
- Temporary passwords are 16-character random strings
- Users must change password on first login
- Password reset generates new temporary password

### Admin Key Rotation
To change admin key:
1. Update `ADMIN_KEY` environment variable in deployment
2. Restart API container
3. Users click "🔑 Change Key" and enter new key

---

## Browser Compatibility

**Supported Browsers**:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Not Supported**:
- ❌ Internet Explorer
- ❌ Opera Mini

**Required Features**:
- ES6+ JavaScript
- CSS Grid
- Fetch API
- LocalStorage

---

## Mobile Responsiveness

The dashboard is **fully responsive** and works on:
- 📱 iPhone/Android phones (portrait & landscape)
- 📱 Tablets (iPad, Android tablets)
- 💻 Laptops and desktops

**Mobile Optimizations**:
- Stacked layouts on small screens
- Touch-friendly buttons (48px minimum)
- Simplified tables with horizontal scroll
- Reduced font sizes for compact display

---

## Changelog

### Version 2.0 (Current) - Unified Dashboard
- ✅ Single-page admin interface with tabs
- ✅ Overview dashboard with key metrics
- ✅ Integrated crawl management
- ✅ Embedding management with migration tools
- ✅ User CRUD operations
- ✅ Consistent design across all sections
- ✅ Smooth tab transitions
- ✅ Responsive mobile layout

### Version 1.0 (Legacy) - Separate Pages
- Crawl management: `admin-old.html`
- Embedding management: `admin-embeddings.html`
- No overview dashboard
- No user management UI

---

## Future Enhancements

**Planned Features**:
- 📊 Real-time stats updates (WebSocket)
- 📈 Charts and graphs for trends
- 🔔 Notification system for job completion
- 📥 Bulk user import from CSV
- 🔍 Advanced search across documents
- ⚙️ System settings configuration
- 📝 Audit log viewer
- 🌐 Multi-language support

**Request Features**: Contact support or create GitHub issue

---

## Support

### Documentation
- Full system docs: `docs/EMBEDDING-MANAGEMENT-SYSTEM.md`
- Chunking details: `docs/DOCUMENT-CHUNKING-IMPLEMENTATION.md`
- API reference: `docs/API-QUICK-START.md`

### Logs
```bash
# API logs
docker logs -f powernova-api

# Database logs
docker logs -f powernova-postgres

# All services
docker-compose -f docker/docker-compose.yml logs -f
```

### Get Help
- Check documentation first
- Review API logs for errors
- Contact: support@powernova.ai

---

## Summary

The **PowerNOVA Admin Dashboard** provides a complete, unified interface for system administration. With its tabbed navigation, real-time statistics, and comprehensive management tools, administrators can efficiently manage crawl jobs, embeddings, and users from a single page.

**Key Benefits**:
- ⚡ Fast and responsive
- 🎨 Modern, consistent design  
- 📱 Mobile-friendly
- 🔒 Secure authentication
- 🔄 Real-time updates
- 💪 Production-ready

Access at: **http://localhost:8080/admin.html**

# Google Drive Integration - Technical Design Document

**Feature**: Allow users to connect their Google Drive and automatically sync documents for RAG-powered Q&A

**Version**: 1.0  
**Date**: December 8, 2025  
**Status**: Design Phase

---

## Table of Contents

1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Google Drive API Integration](#google-drive-api-integration)
7. [Security Considerations](#security-considerations)
8. [Implementation Phases](#implementation-phases)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Considerations](#deployment-considerations)

---

## Overview

### Goals

Enable PowerNOVA users to:
- Connect their Google Drive account via OAuth2
- Select specific folders to sync
- Automatically import documents (PDFs, DOCX, Google Docs, etc.)
- Keep documents up-to-date with automatic sync
- Use synced documents in conversations for RAG-powered Q&A

### Benefits

- **Legal Compliance**: Users own their content, no ToS violations
- **Enterprise Ready**: Works with Google Workspace
- **Auto-sync**: Documents stay current without manual uploads
- **Format Support**: PDFs, Word docs, Google Docs, Sheets, Slides
- **Scalable**: Reuses existing document processing pipeline

### Non-Goals (Out of Scope)

- ❌ Two-way sync (editing Drive files from PowerNOVA)
- ❌ Real-time file watching (polling-based sync is sufficient)
- ❌ Shared folder management (users can only sync their accessible files)
- ❌ Version history tracking (only latest version)

---

## User Stories

### Epic 1: Connect Google Drive

**US-1.1**: As a user, I want to connect my Google Drive account so that I can import my documents into PowerNOVA.

**Acceptance Criteria**:
- User sees "Connect Google Drive" button in settings
- OAuth flow redirects to Google for authorization
- User grants read-only access to Drive
- Connection status shows "Connected" with account email
- User can disconnect at any time

---

**US-1.2**: As a user, I want to see which folders are available in my Drive so that I can choose what to sync.

**Acceptance Criteria**:
- After connecting, user sees list of top-level folders
- User can browse folder hierarchy
- Each folder shows name and file count
- User can expand/collapse folder tree

---

### Epic 2: Sync Documents

**US-2.1**: As a user, I want to select specific folders to sync so that I don't import irrelevant documents.

**Acceptance Criteria**:
- User can select/deselect folders with checkboxes
- "Sync Selected Folders" button initiates import
- Progress indicator shows sync status
- Notification when sync completes

---

**US-2.2**: As a user, I want my documents to auto-sync so that I always have the latest content.

**Acceptance Criteria**:
- System checks for changes every 6 hours (configurable)
- New files are automatically imported
- Updated files trigger re-processing
- Deleted files are marked as inactive (not deleted from DB)

---

**US-2.3**: As a user, I want to see sync status so that I know when my documents are ready.

**Acceptance Criteria**:
- Dashboard shows last sync time
- File count and processing status visible
- Errors are displayed with actionable messages
- Manual "Sync Now" button available

---

### Epic 3: Use Synced Documents

**US-3.1**: As a user, I want to add Drive documents to conversations so that I can ask questions about them.

**Acceptance Criteria**:
- Drive documents appear in document picker
- Marked with Google Drive icon
- Can be added to conversations like uploaded files
- Multiple Drive documents can be added per conversation

---

**US-3.2**: As a user, I want to see the source of answers so that I can verify information.

**Acceptance Criteria**:
- Chat responses cite Drive documents by name
- "View in Google Drive" link opens original file
- File metadata shows last sync time

---

## Architecture

### High-Level Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Click "Connect Drive"
       ▼
┌─────────────────────────┐
│   PowerNOVA Frontend    │
└──────────┬──────────────┘
           │
           │ 2. Initiate OAuth
           ▼
┌─────────────────────────┐
│  Google OAuth Server    │
│  (accounts.google.com)  │
└──────────┬──────────────┘
           │
           │ 3. User authorizes
           ▼
┌─────────────────────────┐
│   OAuth Callback        │
│   /auth/drive/callback  │
└──────────┬──────────────┘
           │
           │ 4. Store tokens (encrypted)
           ▼
┌─────────────────────────┐
│   PostgreSQL            │
│   user_drive_connections│
└─────────────────────────┘

┌─────────────────────────┐
│   Background Worker     │
│   (Periodic Sync)       │
└──────────┬──────────────┘
           │
           │ 5. Fetch files from Drive
           ▼
┌─────────────────────────┐
│   Google Drive API      │
└──────────┬──────────────┘
           │
           │ 6. Download files
           ▼
┌─────────────────────────┐
│   Document Processor    │
│   (Existing Pipeline)   │
└──────────┬──────────────┘
           │
           │ 7. Extract text
           ▼
┌─────────────────────────┐
│   Azure Blob Storage    │
└──────────┬──────────────┘
           │
           │ 8. Generate embeddings
           ▼
┌─────────────────────────┐
│   pgvector              │
│   (RAG Search)          │
└─────────────────────────┘
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     PowerNOVA Backend                        │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ OAuth Routes   │  │ Drive Service  │  │ Sync Worker  │  │
│  │ /auth/drive/*  │  │ - list_files() │  │ - periodic() │  │
│  │                │  │ - download()   │  │ - on_demand()│  │
│  └────────┬───────┘  └────────┬───────┘  └──────┬───────┘  │
│           │                   │                  │          │
│           │                   │                  │          │
│  ┌────────▼───────────────────▼──────────────────▼───────┐  │
│  │           Google Drive API Client                     │  │
│  │           - Token refresh                             │  │
│  │           - Rate limiting                             │  │
│  │           - Error handling                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Existing Document Pipeline                   │  │
│  │         - Text extraction                            │  │
│  │         - Chunking                                   │  │
│  │         - Embedding generation                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     External Services                        │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Google OAuth   │  │ Google Drive   │  │ Azure Blob   │  │
│  │                │  │ API            │  │ Storage      │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

#### `user_drive_connections`

Stores Google Drive OAuth credentials per user.

```sql
CREATE TABLE user_drive_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- OAuth tokens (encrypted at rest)
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    token_expires_at TIMESTAMP,
    
    -- Account info
    google_email TEXT,
    google_user_id TEXT,
    
    -- Status tracking
    status TEXT DEFAULT 'active', -- active, disconnected, error
    last_error TEXT,
    
    -- Timestamps
    connected_at TIMESTAMP DEFAULT NOW(),
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id), -- One Drive connection per user
    CHECK (status IN ('active', 'disconnected', 'error'))
);

CREATE INDEX idx_drive_connections_user ON user_drive_connections(user_id);
CREATE INDEX idx_drive_connections_status ON user_drive_connections(status);
```

---

#### `drive_sync_folders`

Tracks which folders are being synced for each connection.

```sql
CREATE TABLE drive_sync_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES user_drive_connections(id) ON DELETE CASCADE,
    
    -- Google Drive folder info
    drive_folder_id TEXT NOT NULL,
    folder_name TEXT NOT NULL,
    folder_path TEXT, -- e.g., "/My Documents/Work"
    
    -- Sync settings
    auto_sync BOOLEAN DEFAULT true,
    sync_subfolders BOOLEAN DEFAULT true,
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, syncing, completed, error
    last_synced_at TIMESTAMP,
    next_sync_at TIMESTAMP,
    
    -- Stats
    total_files INTEGER DEFAULT 0,
    synced_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(connection_id, drive_folder_id),
    CHECK (status IN ('pending', 'syncing', 'completed', 'error'))
);

CREATE INDEX idx_sync_folders_connection ON drive_sync_folders(connection_id);
CREATE INDEX idx_sync_folders_next_sync ON drive_sync_folders(next_sync_at) 
    WHERE auto_sync = true AND status != 'error';
```

---

#### `drive_files`

Maps Google Drive files to PowerNOVA documents.

```sql
CREATE TABLE drive_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES user_drive_connections(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES drive_sync_folders(id) ON DELETE CASCADE,
    
    -- Google Drive file info
    drive_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,
    drive_modified_time TIMESTAMP,
    drive_created_time TIMESTAMP,
    web_view_link TEXT, -- Link to open in Google Drive
    
    -- PowerNOVA document reference
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    -- Sync status
    status TEXT DEFAULT 'pending', -- pending, processing, completed, error, deleted
    sync_attempts INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Timestamps
    first_synced_at TIMESTAMP,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(connection_id, drive_file_id),
    CHECK (status IN ('pending', 'processing', 'completed', 'error', 'deleted'))
);

CREATE INDEX idx_drive_files_connection ON drive_files(connection_id);
CREATE INDEX idx_drive_files_folder ON drive_files(folder_id);
CREATE INDEX idx_drive_files_document ON drive_files(document_id);
CREATE INDEX idx_drive_files_status ON drive_files(status);
CREATE INDEX idx_drive_files_modified ON drive_files(drive_modified_time);
```

---

### Modified Tables

#### `documents` (existing table)

Add source tracking for Drive files.

```sql
ALTER TABLE documents 
ADD COLUMN source_type TEXT DEFAULT 'upload', -- upload, url, drive, dropbox
ADD COLUMN source_metadata JSONB; -- Store Drive file metadata

CREATE INDEX idx_documents_source_type ON documents(source_type);

-- Example source_metadata for Drive files:
-- {
--   "drive_file_id": "abc123",
--   "drive_connection_id": "uuid",
--   "web_view_link": "https://drive.google.com/file/d/...",
--   "last_drive_sync": "2025-12-08T10:30:00Z"
-- }
```

---

## API Endpoints

### OAuth Endpoints

#### `GET /api/auth/drive/connect`

Initiates OAuth2 flow.

**Request**:
```http
GET /api/auth/drive/connect
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "random_csrf_token"
}
```

**Frontend Flow**:
```javascript
// 1. Call endpoint to get auth URL
const response = await fetch('/api/auth/drive/connect');
const { auth_url } = await response.json();

// 2. Redirect user to Google
window.location.href = auth_url;
```

---

#### `GET /api/auth/drive/callback`

Handles OAuth2 callback from Google.

**Request**:
```http
GET /api/auth/drive/callback?code=...&state=...
```

**Response**:
```json
{
  "success": true,
  "connection": {
    "id": "uuid",
    "google_email": "user@gmail.com",
    "connected_at": "2025-12-08T10:30:00Z"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "OAuth authorization failed",
  "detail": "User denied access"
}
```

---

#### `DELETE /api/auth/drive/disconnect`

Disconnects Google Drive.

**Request**:
```http
DELETE /api/auth/drive/disconnect
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "success": true,
  "message": "Google Drive disconnected successfully"
}
```

**Side Effects**:
- Revokes access token with Google
- Marks connection as 'disconnected'
- Stops auto-sync for all folders
- Does NOT delete synced documents (user can choose to delete manually)

---

### Drive Management Endpoints

#### `GET /api/drive/status`

Get current connection status.

**Request**:
```http
GET /api/drive/status
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "connected": true,
  "connection": {
    "id": "uuid",
    "google_email": "user@gmail.com",
    "connected_at": "2025-12-08T10:30:00Z",
    "last_sync_at": "2025-12-08T14:00:00Z"
  },
  "stats": {
    "total_folders": 5,
    "total_files": 142,
    "synced_files": 138,
    "pending_files": 2,
    "failed_files": 2
  }
}
```

---

#### `GET /api/drive/folders`

List available folders from Google Drive.

**Request**:
```http
GET /api/drive/folders?parent_id={optional_folder_id}
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "folders": [
    {
      "drive_folder_id": "abc123",
      "name": "Work Documents",
      "path": "/Work Documents",
      "file_count": 25,
      "is_synced": true,
      "last_synced_at": "2025-12-08T14:00:00Z"
    },
    {
      "drive_folder_id": "def456",
      "name": "Personal",
      "path": "/Personal",
      "file_count": 48,
      "is_synced": false,
      "last_synced_at": null
    }
  ]
}
```

---

#### `POST /api/drive/folders/sync`

Add folders to sync list.

**Request**:
```http
POST /api/drive/folders/sync
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "folder_ids": ["abc123", "def456"],
  "auto_sync": true,
  "sync_subfolders": true
}
```

**Response**:
```json
{
  "success": true,
  "sync_jobs": [
    {
      "folder_id": "abc123",
      "status": "queued",
      "estimated_files": 25
    },
    {
      "folder_id": "def456",
      "status": "queued",
      "estimated_files": 48
    }
  ]
}
```

---

#### `DELETE /api/drive/folders/{folder_id}/sync`

Stop syncing a folder.

**Request**:
```http
DELETE /api/drive/folders/{folder_id}/sync
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "success": true,
  "message": "Folder removed from sync"
}
```

**Query Parameters**:
- `delete_documents` (boolean, default: false) - Also delete synced documents

---

#### `POST /api/drive/sync/now`

Trigger immediate sync.

**Request**:
```http
POST /api/drive/sync/now
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "folder_ids": ["abc123"], // Optional, sync all if omitted
  "force": false // Force re-download even if not modified
}
```

**Response**:
```json
{
  "success": true,
  "job_id": "uuid",
  "message": "Sync job started",
  "estimated_duration": "2-5 minutes"
}
```

---

#### `GET /api/drive/files`

List synced files.

**Request**:
```http
GET /api/drive/files?folder_id={optional}&status={optional}&page=1&limit=50
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "files": [
    {
      "id": "uuid",
      "drive_file_id": "abc123",
      "file_name": "Q4 Report.pdf",
      "mime_type": "application/pdf",
      "file_size": 2048576,
      "status": "completed",
      "web_view_link": "https://drive.google.com/file/d/abc123/view",
      "document_id": "doc_uuid",
      "last_synced_at": "2025-12-08T14:00:00Z",
      "drive_modified_time": "2025-12-07T09:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 142,
    "pages": 3
  }
}
```

---

## Google Drive API Integration

### OAuth2 Setup

#### Google Cloud Console Configuration

1. **Create Project**:
   - Go to https://console.cloud.google.com
   - Create new project: "PowerNOVA Drive Integration"
   - Note project ID

2. **Enable APIs**:
   - Enable "Google Drive API"
   - Enable "Google Picker API" (for folder browser UI)

3. **Create OAuth Credentials**:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Authorized redirect URIs:
     - Development: `http://localhost:8000/api/auth/drive/callback`
     - Production: `https://powernova.com/api/auth/drive/callback`

4. **OAuth Consent Screen**:
   - User type: "External"
   - App name: "PowerNOVA"
   - User support email: support@powernova.com
   - Scopes:
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/drive.metadata.readonly`

5. **Download Credentials**:
   - Save `client_id` and `client_secret` to environment variables

---

### Environment Variables

```bash
# .env
GOOGLE_DRIVE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_REDIRECT_URI=https://powernova.com/api/auth/drive/callback

# Token encryption key (32 bytes, base64 encoded)
DRIVE_TOKEN_ENCRYPTION_KEY=your_random_32_byte_key_base64_encoded
```

---

### Python Implementation

#### Required Dependencies

```txt
# Add to requirements.txt
google-auth==2.23.0
google-auth-oauthlib==1.1.0
google-auth-httplib2==0.1.1
google-api-python-client==2.108.0
cryptography==42.0.0  # For token encryption (already have this)
```

---

#### OAuth Service (`services/google_drive_oauth.py`)

```python
"""
Google Drive OAuth2 service.
Handles authorization flow and token management.
"""

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import os
import secrets
from cryptography.fernet import Fernet
import base64
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from database.connection import get_db
from models.drive import DriveConnection


class GoogleDriveOAuthService:
    """Manages Google Drive OAuth2 authentication."""
    
    # OAuth scopes
    SCOPES = [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
    ]
    
    def __init__(self):
        self.client_id = os.getenv('GOOGLE_DRIVE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_DRIVE_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GOOGLE_DRIVE_REDIRECT_URI')
        
        # Token encryption
        encryption_key = os.getenv('DRIVE_TOKEN_ENCRYPTION_KEY')
        self.cipher = Fernet(encryption_key.encode())
    
    def get_authorization_url(self, user_id: str) -> Dict[str, str]:
        """
        Generate OAuth authorization URL.
        
        Args:
            user_id: PowerNOVA user ID
            
        Returns:
            Dict with 'auth_url' and 'state'
        """
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )
        
        # Generate CSRF state token
        state = secrets.token_urlsafe(32)
        
        # Store state in session/cache for validation
        # (implementation depends on your session management)
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',  # Get refresh token
            include_granted_scopes='true',
            state=state,
            prompt='consent'  # Force consent to get refresh token
        )
        
        return {
            "auth_url": auth_url,
            "state": state
        }
    
    def handle_callback(
        self, 
        code: str, 
        state: str, 
        user_id: str
    ) -> DriveConnection:
        """
        Handle OAuth callback and store tokens.
        
        Args:
            code: Authorization code from Google
            state: CSRF state token
            user_id: PowerNOVA user ID
            
        Returns:
            DriveConnection object
        """
        # Validate state token (implementation depends on session management)
        # if not self._validate_state(state):
        #     raise ValueError("Invalid state token")
        
        # Exchange code for tokens
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Get user info from Google
        user_info = self._get_user_info(credentials)
        
        # Encrypt tokens
        encrypted_refresh_token = self._encrypt_token(credentials.refresh_token)
        encrypted_access_token = self._encrypt_token(credentials.token)
        
        # Store in database
        db = next(get_db())
        
        # Check if connection already exists
        existing = db.query(DriveConnection).filter(
            DriveConnection.user_id == user_id
        ).first()
        
        if existing:
            # Update existing connection
            existing.refresh_token = encrypted_refresh_token
            existing.access_token = encrypted_access_token
            existing.token_expires_at = credentials.expiry
            existing.google_email = user_info.get('email')
            existing.google_user_id = user_info.get('id')
            existing.status = 'active'
            existing.connected_at = datetime.utcnow()
            connection = existing
        else:
            # Create new connection
            connection = DriveConnection(
                user_id=user_id,
                refresh_token=encrypted_refresh_token,
                access_token=encrypted_access_token,
                token_expires_at=credentials.expiry,
                google_email=user_info.get('email'),
                google_user_id=user_info.get('id'),
                status='active'
            )
            db.add(connection)
        
        db.commit()
        db.refresh(connection)
        
        return connection
    
    def get_credentials(self, connection: DriveConnection) -> Credentials:
        """
        Get valid credentials for API calls.
        Refreshes token if expired.
        
        Args:
            connection: DriveConnection object
            
        Returns:
            Google OAuth2 Credentials
        """
        # Decrypt tokens
        refresh_token = self._decrypt_token(connection.refresh_token)
        access_token = self._decrypt_token(connection.access_token) if connection.access_token else None
        
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=self.SCOPES
        )
        
        # Refresh if expired
        if credentials.expired or not credentials.valid:
            credentials.refresh(Request())
            
            # Update stored tokens
            db = next(get_db())
            connection.access_token = self._encrypt_token(credentials.token)
            connection.token_expires_at = credentials.expiry
            db.commit()
        
        return credentials
    
    def disconnect(self, connection: DriveConnection):
        """
        Disconnect Google Drive.
        Revokes tokens and marks connection as disconnected.
        
        Args:
            connection: DriveConnection object
        """
        try:
            credentials = self.get_credentials(connection)
            
            # Revoke token with Google
            import requests
            requests.post(
                'https://oauth2.googleapis.com/revoke',
                params={'token': credentials.token},
                headers={'content-type': 'application/x-www-form-urlencoded'}
            )
        except Exception as e:
            # Log error but continue
            print(f"Error revoking token: {e}")
        
        # Update database
        db = next(get_db())
        connection.status = 'disconnected'
        connection.access_token = None
        db.commit()
    
    def _get_user_info(self, credentials: Credentials) -> Dict[str, Any]:
        """Get user info from Google."""
        service = build('oauth2', 'v2', credentials=credentials)
        return service.userinfo().get().execute()
    
    def _encrypt_token(self, token: str) -> str:
        """Encrypt token for storage."""
        if not token:
            return None
        return self.cipher.encrypt(token.encode()).decode()
    
    def _decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt token from storage."""
        if not encrypted_token:
            return None
        return self.cipher.decrypt(encrypted_token.encode()).decode()
```

---

#### Drive API Service (`services/google_drive_service.py`)

```python
"""
Google Drive API service.
Handles file listing, downloading, and metadata operations.
"""

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials
from typing import List, Dict, Any, Optional, BinaryIO
import io
from datetime import datetime

from services.google_drive_oauth import GoogleDriveOAuthService
from models.drive import DriveConnection


class GoogleDriveService:
    """Manages Google Drive file operations."""
    
    # Supported MIME types
    SUPPORTED_MIME_TYPES = {
        # Native Drive formats (export as PDF or text)
        'application/vnd.google-apps.document': 'application/pdf',  # Google Docs
        'application/vnd.google-apps.spreadsheet': 'application/pdf',  # Sheets
        'application/vnd.google-apps.presentation': 'application/pdf',  # Slides
        
        # Standard formats (download as-is)
        'application/pdf': None,
        'application/msword': None,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': None,
        'text/plain': None,
        'text/html': None,
        'application/rtf': None,
    }
    
    def __init__(self, oauth_service: GoogleDriveOAuthService = None):
        self.oauth_service = oauth_service or GoogleDriveOAuthService()
    
    def _get_service(self, connection: DriveConnection):
        """Get authenticated Drive API service."""
        credentials = self.oauth_service.get_credentials(connection)
        return build('drive', 'v3', credentials=credentials)
    
    def list_folders(
        self, 
        connection: DriveConnection,
        parent_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List folders in Google Drive.
        
        Args:
            connection: DriveConnection object
            parent_id: Parent folder ID (None for root)
            
        Returns:
            List of folder dictionaries
        """
        service = self._get_service(connection)
        
        # Build query
        query_parts = ["mimeType='application/vnd.google-apps.folder'"]
        if parent_id:
            query_parts.append(f"'{parent_id}' in parents")
        else:
            query_parts.append("'root' in parents")
        
        query_parts.append("trashed=false")
        query = " and ".join(query_parts)
        
        # Fetch folders
        results = service.files().list(
            q=query,
            pageSize=100,
            fields="files(id, name, parents, createdTime, modifiedTime)",
            orderBy="name"
        ).execute()
        
        folders = results.get('files', [])
        
        # Get file counts for each folder
        for folder in folders:
            folder['file_count'] = self._get_file_count(service, folder['id'])
        
        return folders
    
    def list_files(
        self,
        connection: DriveConnection,
        folder_id: str,
        page_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List files in a folder.
        
        Args:
            connection: DriveConnection object
            folder_id: Folder ID
            page_token: Pagination token
            
        Returns:
            Dict with 'files' and 'next_page_token'
        """
        service = self._get_service(connection)
        
        # Build query for supported file types
        mime_type_query = " or ".join([
            f"mimeType='{mime}'" 
            for mime in self.SUPPORTED_MIME_TYPES.keys()
        ])
        
        query = (
            f"'{folder_id}' in parents "
            f"and ({mime_type_query}) "
            f"and trashed=false"
        )
        
        # Fetch files
        results = service.files().list(
            q=query,
            pageSize=100,
            pageToken=page_token,
            fields=(
                "nextPageToken, "
                "files(id, name, mimeType, size, createdTime, modifiedTime, "
                "webViewLink, thumbnailLink)"
            ),
            orderBy="modifiedTime desc"
        ).execute()
        
        return {
            'files': results.get('files', []),
            'next_page_token': results.get('nextPageToken')
        }
    
    def download_file(
        self,
        connection: DriveConnection,
        file_id: str,
        mime_type: str
    ) -> bytes:
        """
        Download file content.
        
        Args:
            connection: DriveConnection object
            file_id: Google Drive file ID
            mime_type: File MIME type
            
        Returns:
            File content as bytes
        """
        service = self._get_service(connection)
        
        # Check if needs export (Google Docs formats)
        export_mime_type = self.SUPPORTED_MIME_TYPES.get(mime_type)
        
        if export_mime_type:
            # Export Google Docs as PDF
            request = service.files().export_media(
                fileId=file_id,
                mimeType=export_mime_type
            )
        else:
            # Download regular file
            request = service.files().get_media(fileId=file_id)
        
        # Download to bytes
        file_buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(file_buffer, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        return file_buffer.getvalue()
    
    def get_file_metadata(
        self,
        connection: DriveConnection,
        file_id: str
    ) -> Dict[str, Any]:
        """
        Get file metadata.
        
        Args:
            connection: DriveConnection object
            file_id: Google Drive file ID
            
        Returns:
            File metadata dictionary
        """
        service = self._get_service(connection)
        
        return service.files().get(
            fileId=file_id,
            fields=(
                "id, name, mimeType, size, createdTime, modifiedTime, "
                "webViewLink, thumbnailLink, parents"
            )
        ).execute()
    
    def check_for_changes(
        self,
        connection: DriveConnection,
        folder_id: str,
        last_check: datetime
    ) -> List[Dict[str, Any]]:
        """
        Check for new or modified files since last sync.
        
        Args:
            connection: DriveConnection object
            folder_id: Folder ID
            last_check: Last check timestamp
            
        Returns:
            List of changed files
        """
        service = self._get_service(connection)
        
        # Format timestamp for Drive API
        timestamp_str = last_check.isoformat() + 'Z'
        
        # Build query
        mime_type_query = " or ".join([
            f"mimeType='{mime}'" 
            for mime in self.SUPPORTED_MIME_TYPES.keys()
        ])
        
        query = (
            f"'{folder_id}' in parents "
            f"and ({mime_type_query}) "
            f"and modifiedTime > '{timestamp_str}' "
            f"and trashed=false"
        )
        
        # Fetch changed files
        results = service.files().list(
            q=query,
            pageSize=1000,
            fields="files(id, name, mimeType, size, modifiedTime)",
            orderBy="modifiedTime desc"
        ).execute()
        
        return results.get('files', [])
    
    def _get_file_count(self, service, folder_id: str) -> int:
        """Get count of supported files in folder."""
        mime_type_query = " or ".join([
            f"mimeType='{mime}'" 
            for mime in self.SUPPORTED_MIME_TYPES.keys()
        ])
        
        query = (
            f"'{folder_id}' in parents "
            f"and ({mime_type_query}) "
            f"and trashed=false"
        )
        
        results = service.files().list(
            q=query,
            pageSize=1,
            fields="files(id)"
        ).execute()
        
        # Note: This doesn't give exact count, but indicates if empty
        return len(results.get('files', []))
```

---

## Security Considerations

### Token Security

1. **Encryption at Rest**:
   - All OAuth tokens stored encrypted in database
   - Use Fernet symmetric encryption (from `cryptography` library)
   - Encryption key stored in environment variable
   - Rotate encryption key periodically

2. **Token Access**:
   - Never expose tokens in API responses
   - Decrypt only when making Drive API calls
   - Use short-lived access tokens (1 hour TTL)
   - Refresh tokens automatically

3. **CSRF Protection**:
   - Use state parameter in OAuth flow
   - Validate state matches on callback
   - Generate cryptographically secure random state

---

### API Security

1. **Authentication**:
   - All endpoints require valid JWT
   - User can only access their own Drive connection
   - Admin role can view stats (not tokens)

2. **Rate Limiting**:
   - Implement rate limits per user
   - Suggested limits:
     - Connect/Disconnect: 5/hour
     - List folders: 30/minute
     - Sync: 10/hour
     - File operations: 100/minute

3. **Input Validation**:
   - Validate folder IDs format
   - Sanitize file names
   - Check file size limits (max 100MB per file)
   - Validate MIME types

---

### Data Privacy

1. **User Data**:
   - Users control which folders to sync
   - Documents are private to user's account
   - No sharing of Drive content between users
   - Users can delete synced documents anytime

2. **Google Data**:
   - Only request readonly permissions
   - Don't store file content permanently (only processed embeddings)
   - Respect Drive file sharing settings
   - Clear user data on disconnect (optional)

3. **Compliance**:
   - GDPR: Right to delete all synced data
   - Terms of Service: Clear about data usage
   - Privacy Policy: Disclose Drive access

---

### Error Handling

1. **Token Expiration**:
   - Automatically refresh access tokens
   - Handle refresh token revocation gracefully
   - Notify user if re-authorization needed

2. **API Errors**:
   - Handle rate limits (exponential backoff)
   - Retry transient failures (network issues)
   - Log errors for debugging
   - Don't expose Google API errors to frontend

3. **Sync Failures**:
   - Mark files as 'error' status
   - Store error message for debugging
   - Allow manual retry
   - Alert user after 3 consecutive failures

---

## Implementation Phases

### Phase 1: OAuth Connection (Week 1)

**Goal**: Users can connect/disconnect Google Drive

**Tasks**:
- [ ] Set up Google Cloud Console project
- [ ] Create OAuth credentials
- [ ] Implement OAuth service (`google_drive_oauth.py`)
- [ ] Create database tables
- [ ] Implement OAuth endpoints:
  - [ ] GET `/api/auth/drive/connect`
  - [ ] GET `/api/auth/drive/callback`
  - [ ] DELETE `/api/auth/drive/disconnect`
  - [ ] GET `/api/drive/status`
- [ ] Add token encryption/decryption
- [ ] Frontend: Connection UI in settings
- [ ] Testing: OAuth flow end-to-end

**Deliverables**:
- Working OAuth connection
- Connection status display
- Disconnect functionality

---

### Phase 2: Folder Browsing (Week 2)

**Goal**: Users can view and select folders

**Tasks**:
- [ ] Implement Drive service (`google_drive_service.py`)
- [ ] Implement endpoints:
  - [ ] GET `/api/drive/folders`
- [ ] Frontend: Folder browser UI
  - [ ] Tree view with expand/collapse
  - [ ] Folder selection checkboxes
  - [ ] File count badges
- [ ] Testing: Folder listing

**Deliverables**:
- Folder browsing UI
- Folder metadata display

---

### Phase 3: File Syncing (Week 3)

**Goal**: Users can sync folders and view files

**Tasks**:
- [ ] Implement sync logic:
  - [ ] Create `drive_sync_folders` records
  - [ ] Create `drive_files` records
  - [ ] Download file content
- [ ] Implement endpoints:
  - [ ] POST `/api/drive/folders/sync`
  - [ ] DELETE `/api/drive/folders/{id}/sync`
  - [ ] GET `/api/drive/files`
- [ ] Integrate with existing document processor:
  - [ ] Save to Azure Blob Storage
  - [ ] Extract text
  - [ ] Generate embeddings
  - [ ] Create `documents` records
- [ ] Frontend: Sync progress UI
- [ ] Testing: Single folder sync

**Deliverables**:
- Manual folder sync
- File list display
- Integration with RAG pipeline

---

### Phase 4: Background Worker (Week 4)

**Goal**: Automatic periodic sync

**Tasks**:
- [ ] Create sync worker (`workers/drive_sync_worker.py`)
- [ ] Implement change detection:
  - [ ] Check `modifiedTime` in Drive API
  - [ ] Compare with `last_synced_at`
  - [ ] Download only changed files
- [ ] Implement endpoints:
  - [ ] POST `/api/drive/sync/now`
- [ ] Schedule periodic sync (every 6 hours)
- [ ] Error handling and retry logic
- [ ] Frontend: Last sync time display
- [ ] Testing: Auto-sync flow

**Deliverables**:
- Background sync worker
- Change detection
- Manual "Sync Now" button

---

### Phase 5: Conversation Integration (Week 5)

**Goal**: Use Drive documents in conversations

**Tasks**:
- [ ] Update document picker:
  - [ ] Show Drive documents with icon
  - [ ] Filter by source type
- [ ] Update chat responses:
  - [ ] Show "View in Drive" links
  - [ ] Display Drive file metadata
- [ ] Update profile page:
  - [ ] Show Drive documents separately
  - [ ] Sync status badges
- [ ] Testing: End-to-end conversation flow

**Deliverables**:
- Drive documents in conversations
- Source attribution in responses
- Profile page integration

---

### Phase 6: Polish & Optimization (Week 6)

**Goal**: Production-ready feature

**Tasks**:
- [ ] Performance optimization:
  - [ ] Batch file downloads
  - [ ] Parallel processing
  - [ ] Database query optimization
- [ ] Error handling:
  - [ ] User-friendly error messages
  - [ ] Retry mechanisms
  - [ ] Logging and monitoring
- [ ] UI/UX improvements:
  - [ ] Loading states
  - [ ] Empty states
  - [ ] Error states
  - [ ] Success notifications
- [ ] Documentation:
  - [ ] User guide
  - [ ] API documentation
  - [ ] Deployment guide
- [ ] Security audit
- [ ] Load testing

**Deliverables**:
- Production-ready feature
- Complete documentation
- Performance benchmarks

---

## Testing Strategy

### Unit Tests

**OAuth Service**:
```python
def test_encrypt_decrypt_token():
    """Test token encryption/decryption."""
    service = GoogleDriveOAuthService()
    original = "secret_token_123"
    encrypted = service._encrypt_token(original)
    decrypted = service._decrypt_token(encrypted)
    assert decrypted == original

def test_get_authorization_url():
    """Test OAuth URL generation."""
    service = GoogleDriveOAuthService()
    result = service.get_authorization_url("user_123")
    assert "auth_url" in result
    assert "state" in result
    assert "accounts.google.com" in result["auth_url"]
```

**Drive Service**:
```python
def test_list_folders(mock_drive_api):
    """Test folder listing."""
    service = GoogleDriveService()
    connection = create_test_connection()
    folders = service.list_folders(connection)
    assert isinstance(folders, list)
    assert all('id' in f and 'name' in f for f in folders)

def test_download_file(mock_drive_api):
    """Test file download."""
    service = GoogleDriveService()
    connection = create_test_connection()
    content = service.download_file(connection, "file_123", "application/pdf")
    assert isinstance(content, bytes)
    assert len(content) > 0
```

---

### Integration Tests

**OAuth Flow**:
```python
def test_oauth_flow_end_to_end():
    """Test complete OAuth flow."""
    # 1. Get auth URL
    response = client.get("/api/auth/drive/connect")
    assert response.status_code == 200
    auth_url = response.json()["auth_url"]
    
    # 2. Simulate callback (with mock)
    response = client.get(
        "/api/auth/drive/callback",
        params={"code": "mock_code", "state": "mock_state"}
    )
    assert response.status_code == 200
    
    # 3. Check connection status
    response = client.get("/api/drive/status")
    assert response.json()["connected"] == True
```

**Sync Flow**:
```python
def test_folder_sync_flow():
    """Test folder sync process."""
    # 1. List folders
    response = client.get("/api/drive/folders")
    folders = response.json()["folders"]
    folder_id = folders[0]["drive_folder_id"]
    
    # 2. Start sync
    response = client.post(
        "/api/drive/folders/sync",
        json={"folder_ids": [folder_id]}
    )
    assert response.status_code == 200
    
    # 3. Wait for completion (or poll)
    time.sleep(5)
    
    # 4. Check synced files
    response = client.get(f"/api/drive/files?folder_id={folder_id}")
    files = response.json()["files"]
    assert len(files) > 0
    assert all(f["status"] == "completed" for f in files)
```

---

### Load Tests

**Concurrent Syncs**:
```python
def test_concurrent_folder_syncs():
    """Test multiple users syncing simultaneously."""
    users = create_test_users(10)
    
    def sync_user_folder(user):
        response = client.post(
            "/api/drive/folders/sync",
            headers={"Authorization": f"Bearer {user.token}"},
            json={"folder_ids": ["test_folder_123"]}
        )
        return response.status_code == 200
    
    # Run concurrently
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(sync_user_folder, users))
    
    assert all(results)
```

---

### Manual Testing Checklist

- [ ] Connect Google Drive with real account
- [ ] Browse folders (root and nested)
- [ ] Select folder and start sync
- [ ] Verify files downloaded to Azure Blob
- [ ] Verify embeddings generated
- [ ] Add Drive document to conversation
- [ ] Ask question about Drive document
- [ ] Verify response cites Drive document
- [ ] Click "View in Drive" link
- [ ] Modify file in Drive
- [ ] Wait for auto-sync or trigger manual sync
- [ ] Verify updated content in conversation
- [ ] Disconnect Drive
- [ ] Verify tokens revoked

---

## Deployment Considerations

### Environment Setup

**Development**:
```bash
# .env.local
GOOGLE_DRIVE_CLIENT_ID=dev_client_id
GOOGLE_DRIVE_CLIENT_SECRET=dev_secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:8000/api/auth/drive/callback
DRIVE_TOKEN_ENCRYPTION_KEY=dev_encryption_key_32_bytes
```

**Production**:
```bash
# Azure Key Vault or environment variables
GOOGLE_DRIVE_CLIENT_ID=prod_client_id
GOOGLE_DRIVE_CLIENT_SECRET=prod_secret
GOOGLE_DRIVE_REDIRECT_URI=https://powernova.com/api/auth/drive/callback
DRIVE_TOKEN_ENCRYPTION_KEY=prod_encryption_key_32_bytes
```

---

### Database Migration

```bash
# Create migration
alembic revision --autogenerate -m "Add Google Drive integration"

# Review migration file
# Edit if needed (especially indexes and constraints)

# Apply migration
alembic upgrade head
```

---

### Worker Deployment

**Add to docker-compose.yml**:
```yaml
powernova-drive-sync-worker:
  build:
    context: ../api
    dockerfile: ../docker/Dockerfile.api.local
  container_name: powernova-drive-sync-worker
  env_file:
    - ../api/.env
  environment:
    - WORKER_MODE=drive_sync
  depends_on:
    - powernova-postgres
  restart: unless-stopped
```

**Worker startup script**:
```python
# workers/drive_sync_worker.py
if __name__ == "__main__":
    worker = DriveSyncWorker()
    worker.run_forever(interval=6 * 60 * 60)  # Every 6 hours
```

---

### Monitoring

**Key Metrics**:
- OAuth connection success rate
- Token refresh failures
- Sync job duration
- Failed file downloads
- Drive API rate limit hits
- Storage usage (Azure Blob)

**Alerts**:
- High error rate (> 5%)
- Long sync duration (> 30 min)
- Token refresh failures
- Rate limit exceeded

**Logging**:
```python
logger.info(f"Drive sync started: user={user_id}, folder={folder_id}")
logger.info(f"Downloaded {file_count} files in {duration}s")
logger.error(f"Sync failed: user={user_id}, error={error}")
```

---

### Rollout Plan

1. **Alpha (Week 1)**:
   - Deploy to staging
   - Internal team testing
   - Fix critical bugs

2. **Beta (Week 2-3)**:
   - Enable for 10-20 beta users
   - Monitor performance and errors
   - Gather feedback
   - Fix issues

3. **General Availability (Week 4)**:
   - Enable for all users
   - Announce feature
   - Monitor closely for first week
   - Scale infrastructure if needed

---

## Appendix

### Google Drive API Quotas

**Free Tier**:
- 20,000 requests/day per project
- 1,000 requests/100 seconds per user

**Optimization Tips**:
- Use batch requests where possible
- Implement exponential backoff
- Cache folder listings
- Only fetch changed files

---

### MIME Type Handling

| Drive Format | Export As | Extension |
|--------------|-----------|-----------|
| Google Doc | PDF | .pdf |
| Google Sheet | PDF | .pdf |
| Google Slides | PDF | .pdf |
| PDF | (download) | .pdf |
| Word Doc | (download) | .docx |
| Text File | (download) | .txt |

---

### Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 401 | Invalid credentials | Refresh token or re-authorize |
| 403 | Rate limit exceeded | Exponential backoff |
| 404 | File not found | Skip and log |
| 500 | Google API error | Retry with backoff |

---

### Future Enhancements

**Phase 7+ Ideas**:
- [ ] Dropbox integration (similar architecture)
- [ ] OneDrive integration
- [ ] Selective file sync (by type/pattern)
- [ ] Shared folder support (team workspaces)
- [ ] Real-time sync (Drive API webhooks)
- [ ] File preview in PowerNOVA
- [ ] Version history tracking
- [ ] Folder hierarchy in RAG context
- [ ] Smart folder recommendations
- [ ] Sync analytics dashboard

---

## References

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Python Quickstart for Drive API](https://developers.google.com/drive/api/quickstart/python)
- [Best Practices for Drive API](https://developers.google.com/drive/api/guides/performance)

---

**Document Status**: ✅ Ready for Review  
**Next Steps**: Review → Approve → Begin Phase 1 Implementation

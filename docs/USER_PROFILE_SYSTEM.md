# PowerNOVA User Profile System

A comprehensive user profile and settings system for the PowerNOVA React Native app with Node.js backend.

## Features

### 🔐 User Profile Management
- **Firebase Authentication Integration**: Seamless user authentication
- **Profile Information**: Display name, email, profile picture
- **Account Management**: Update profile, delete account

### ⚙️ User Settings
- **Notifications**:
  - Email notifications
  - Push notifications  
  - Marketing emails
- **App Preferences**:
  - Theme selection (light, dark, auto)
  - Language preference
  - Auto-play voice responses
  - Voice speed control (0.5x to 2.0x)
  - Default view setting
- **Privacy Controls**:
  - Analytics tracking
  - Crash reporting
  - Custom settings (JSON storage)

### 📱 React Native Interface
- **Modern UI**: Clean, intuitive settings interface
- **Real-time Updates**: Settings saved instantly
- **Error Handling**: Comprehensive error handling and user feedback
- **Responsive Design**: Works on all device sizes

## Backend API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/user/profile` | Get user profile and settings |
| `PUT` | `/api/user/profile` | Update user profile |
| `PUT` | `/api/user/settings` | Update user settings |
| `DELETE` | `/api/user/account` | Delete user account |

### Database Schema

#### Users Table
```sql
users:
- id (SERIAL PRIMARY KEY)
- firebase_uid (VARCHAR, UNIQUE)
- email (VARCHAR, UNIQUE)
- display_name (VARCHAR)
- photo_url (TEXT)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP)
```

#### User Settings Table
```sql
user_settings:
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER, FK to users.id)
- email_notifications (BOOLEAN)
- push_notifications (BOOLEAN)
- marketing_emails (BOOLEAN)
- theme (VARCHAR: 'light'|'dark'|'auto')
- language (VARCHAR)
- timezone (VARCHAR)
- auto_play_voice (BOOLEAN)
- voice_speed (NUMERIC 0.5-2.0)
- default_view (VARCHAR)
- analytics_enabled (BOOLEAN)
- crash_reporting (BOOLEAN)
- custom_settings (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## Installation & Setup

### 1. Database Migration

Run the database migration to create the necessary tables:

```bash
cd backend
./migrate_database.sh
```

**Prerequisites:**
- PostgreSQL client (`psql`) installed
- Environment variables set:
  - `POWERNOVA_HOST`
  - `POWERNOVA_DB`
  - `POWERNOVA_USER`
  - `POWERNOVA_PASSWORD`

### 2. Backend Setup

The user controller is automatically included in the Node.js backend:

```javascript
// Already added to backend/src/app.js
app.use('/api/user', authMiddleware, userController);
```

### 3. Frontend Integration

The ProfileScreen is integrated into the React Native app:

- **Access**: Tap the profile icon in the header or use the sidebar
- **Navigation**: Automatically integrated with the app's navigation system
- **State Management**: Settings are persisted and synchronized with the backend

## Usage

### Accessing User Profile

1. **Header Button**: Tap the profile icon in the app header
2. **User Info**: Tap on the user info section in the header
3. **Sidebar**: Use the "Profile" option in the sidebar menu

### Profile Management

- **Edit Display Name**: Update your display name
- **View Account Info**: See account creation date and login status
- **Sign Out**: Quick sign out from the profile screen
- **Delete Account**: Permanently delete your account (with confirmation)

### Settings Configuration

#### Notifications
- Toggle email notifications on/off
- Control push notifications
- Manage marketing email preferences

#### App Preferences
- **Theme**: Choose between light, dark, or auto (system) theme
- **Voice Settings**: 
  - Enable/disable auto-play for voice responses
  - Adjust voice speed from 0.5x to 2.0x
- **Default View**: Set which screen opens by default

#### Privacy
- **Analytics**: Control usage data collection
- **Crash Reporting**: Enable/disable crash report sending

## API Usage Examples

### Get User Profile
```javascript
const response = await fetch('/api/user/profile', {
  headers: {
    'Authorization': `Bearer ${firebaseToken}`,
    'Content-Type': 'application/json'
  }
});
const { user, settings } = await response.json();
```

### Update Settings
```javascript
const response = await fetch('/api/user/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${firebaseToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    theme: 'dark',
    voice_speed: 1.5,
    email_notifications: false
  })
});
```

## Security Features

- **Firebase Authentication**: All endpoints require valid Firebase ID tokens
- **User Isolation**: Users can only access their own data
- **Input Validation**: Comprehensive validation of all inputs
- **SQL Injection Protection**: Parameterized queries throughout
- **Rate Limiting**: Built-in rate limiting for API endpoints

## Error Handling

The system includes comprehensive error handling:

- **Network Errors**: Graceful handling of connectivity issues
- **Authentication Errors**: Clear feedback for auth problems
- **Validation Errors**: User-friendly validation messages
- **Server Errors**: Proper error reporting and recovery

## File Structure

```
backend/
├── src/
│   └── controllers/
│       └── userController.js     # User API endpoints
├── database_migration.sql        # Database schema
└── migrate_database.sh          # Migration script

app/
├── screens/
│   └── ProfileScreen.js         # Main profile interface
└── components/
    └── ui/
        └── Sidebar.js           # Updated with profile option
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify environment variables are set correctly
   - Check database connectivity
   - Ensure migration script has been run

2. **Authentication Errors**
   - Verify Firebase configuration
   - Check ID token validity
   - Ensure user is properly signed in

3. **Settings Not Saving**
   - Check network connectivity
   - Verify API endpoint availability
   - Review browser/app console for errors

### Debug Mode

Enable debug logging by setting environment variables:
```bash
export DEBUG=powernova:user
export NODE_ENV=development
```

## Contributing

When adding new settings:

1. **Database**: Add new columns to `user_settings` table
2. **Backend**: Update the userController.js validation
3. **Frontend**: Add UI controls in ProfileScreen.js
4. **Schema**: Update the API documentation

## License

This user profile system is part of the PowerNOVA application and follows the same licensing terms.

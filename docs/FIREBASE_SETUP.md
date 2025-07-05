# Firebase Service Account Setup

## Overview

The PowerNOVA backend uses Firebase Admin SDK to authenticate users and manage data. This requires a service account key for server-to-server authentication.

## Quick Setup

### Option 1: Service Account File (Recommended)

1. **Download Service Account Key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `powernova-6753c`
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the downloaded JSON file as `backend/firebase-service-account.json`

2. **Test the Setup:**
   ```bash
   npm run setup:firebase
   ```

3. **Start Backend:**
   ```bash
   npm run dev:backend
   ```

### Option 2: Environment Variables

If you prefer environment variables, add these to `backend/.env`:

```bash
FIREBASE_PROJECT_ID=powernova-6753c
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@powernova-6753c.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

## How It Works

The backend automatically detects which method to use:

1. **First Priority**: Looks for `backend/firebase-service-account.json`
2. **Fallback**: Uses environment variables from `backend/.env`
3. **Error**: Throws helpful error message if neither is found

## Security

- ✅ `firebase-service-account.json` is in `.gitignore`
- ✅ Service account has minimal required permissions
- ✅ No sensitive data exposed to frontend
- ✅ Secure server-to-server authentication

## Troubleshooting

### Common Issues

**"Service account file not found":**
- Download the service account key from Firebase Console
- Save it exactly as `backend/firebase-service-account.json`

**"Invalid JSON":**
- Check that the downloaded file is valid JSON
- Don't modify the downloaded file

**"Authentication failed":**
- Verify the service account has proper permissions
- Check that the project ID matches your Firebase project

### Testing Your Setup

```bash
# Test Firebase connection
npm run setup:firebase

# Check backend logs
cd backend
npm run dev
```

The backend will show Firebase initialization status in the console:

```
✅ Firebase Admin initialized successfully with service account file
📋 Project ID: powernova-6753c
📧 Service Account: firebase-adminsdk-xxxxx@powernova-6753c.iam.gserviceaccount.com
```

## Next Steps

After Firebase is set up:

1. Configure other API keys (OpenAI, Pinecone)
2. Update frontend Firebase config
3. Start development with `npm run dev`

For more help, see the main [README.md](../README.md) or run `./setup.sh` for complete setup.

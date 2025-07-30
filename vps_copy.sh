#!/bin/bash

# Go to project root (adjust path if needed)
cd "$(dirname "$0")"

# --- Package the app folder (production build) ---
echo "🌐 Building app for production..."
cd app
npx expo export --platform web

echo "📦 Creating app_web_build.tar.gz from web-build/..."
tar czf ../app_web_build.tar.gz web-build
cd ..

# --- Package the backend folder using npm pack ---
echo "📦 Creating backend npm package..."
cd backend
npm pack
cd ..
# Find the generated .tgz file (should be backend-*.tgz)
BACKEND_TGZ=$(ls backend/*.tgz | tail -n 1)

# --- Upload both packages to VPS /tmp directory ---
echo "🚀 Uploading app_web_build.tar.gz to ${VPS_USER}@${VPS_IP}:${DEST_DIR}..."
scp app_web_build.tar.gz ${VPS_USER}@${VPS_IP}:${DEST_DIR}/

echo "🚀 Uploading backend package (${BACKEND_TGZ}) to ${VPS_USER}@${VPS_IP}:${DEST_DIR}..."
scp "${BACKEND_TGZ}" ${VPS_USER}@${VPS_IP}:${DEST_DIR}/

echo "✅ Done! Both packages uploaded to ${VPS_IP}:${DEST_DIR}/"
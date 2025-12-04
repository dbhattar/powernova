# PowerNOVA Chat App - Dockerfile
# Multi-stage build: Build React app, then serve with nginx

# Stage 1: Build the React app
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY app-react/package*.json ./

# Clean install to avoid optional dependency issues
# Delete package-lock.json and use npm install to regenerate for Alpine
# Don't set NODE_ENV=production yet as we need devDependencies for build
RUN rm -f package-lock.json && npm install

# Copy source code (excluding node_modules which we just installed)
COPY app-react/ ./

# Build the React app for production
# Explicitly set --mode production to ensure .env.production is used
# Override base path to root (/) for production deployment
RUN VITE_BASE_PATH=/ npm run build -- --mode production

# Stage 2: Serve with nginx
FROM nginx:alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx files
RUN rm -rf ./*

# Copy nginx configuration
COPY docker/nginx-app.conf /etc/nginx/conf.d/default.conf

# Copy built React app from builder stage
COPY --from=builder /app/dist/ .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

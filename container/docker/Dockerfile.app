# PowerNOVA Chat App - Dockerfile
# Lightweight nginx container for serving the chat interface

FROM nginx:alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx files
RUN rm -rf ./*

# Copy nginx configuration
COPY docker/nginx-app.conf /etc/nginx/conf.d/default.conf

# Copy chat app files
COPY app/ .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

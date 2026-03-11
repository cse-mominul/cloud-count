# Backend Dockerfile for Sohel Gadgets
FROM node:22-alpine

# Set timezone to Asia/Dhaka
ENV TZ=Asia/Dhaka
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++ curl busybox-extras

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create uploads directory for file uploads
RUN mkdir -p uploads && chown -R node:node /app

# Make wait script executable
RUN chmod +x wait-for-mongo.sh

# Switch to non-root user
USER node

# Expose port 5000
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000 || exit 1

# Start the application
CMD ["npm", "start"]

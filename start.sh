#!/bin/bash

# Sohel Gadgets - Docker Startup Script
# This script starts all services in the correct order with proper health checks

set -e

echo "🚀 Starting Sohel Gadgets Inventory Management System..."
echo "📍 Timezone: Asia/Dhaka"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

echo "📦 Building and starting services..."

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start services
echo "🔨 Building images and starting services..."
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for MongoDB to be healthy
echo "🍃 Waiting for MongoDB..."
until docker-compose exec -T db mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
    echo "   MongoDB is not ready yet..."
    sleep 5
done
echo "✅ MongoDB is ready!"

# Wait for Backend to be healthy
echo "🔧 Waiting for Backend API..."
until curl -f http://localhost:5000 >/dev/null 2>&1; do
    echo "   Backend is not ready yet..."
    sleep 5
done
echo "✅ Backend API is ready!"

# Wait for Frontend to be ready
echo "🌐 Waiting for Frontend..."
until curl -f http://localhost:5173 >/dev/null 2>&1; do
    echo "   Frontend is not ready yet..."
    sleep 5
done
echo "✅ Frontend is ready!"

echo ""
echo "🎉 All services are running successfully!"
echo ""
echo "📊 Service URLs:"
echo "   🌐 Frontend:     http://localhost:5173"
echo "   🔧 Backend API:  http://localhost:5000"
echo "   🍃 MongoDB:      mongodb://localhost:27017"
echo "   📈 Mongo Express: http://localhost:8081"
echo ""
echo "🔐 Default Login Credentials:"
echo "   Email:    admin@sohelgadgets.com"
echo "   Password: admin123"
echo ""
echo "⚠️  IMPORTANT: Please change the default password and JWT secret after first login!"
echo ""
echo "📝 To view logs: docker-compose logs -f [service-name]"
echo "🛑 To stop:      docker-compose down"
echo "🔄 To restart:   docker-compose restart [service-name]"

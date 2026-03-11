@echo off
REM Sohel Gadgets - Docker Startup Script for Windows
REM This script starts all services in the correct order with proper health checks

echo 🚀 Starting Sohel Gadgets Inventory Management System...
echo 📍 Timezone: Asia/Dhaka
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ docker-compose is not available. Please install docker-compose first.
    pause
    exit /b 1
)

echo 📦 Building and starting services...

REM Stop any existing containers
echo 🛑 Stopping existing containers...
docker-compose down

REM Build and start services
echo 🔨 Building images and starting services...
docker-compose up --build -d

echo.
echo ⏳ Waiting for services to be ready...

REM Wait for MongoDB to be healthy
echo 🍃 Waiting for MongoDB...
:wait_mongo
docker-compose exec -T db mongosh --eval "db.adminCommand('ping')" >nul 2>&1
if %errorlevel% neq 0 (
    echo    MongoDB is not ready yet...
    timeout /t 5 /nobreak >nul
    goto wait_mongo
)
echo ✅ MongoDB is ready!

REM Wait for Backend to be healthy
echo 🔧 Waiting for Backend API...
:wait_backend
curl -f http://localhost:5000 >nul 2>&1
if %errorlevel% neq 0 (
    echo    Backend is not ready yet...
    timeout /t 5 /nobreak >nul
    goto wait_backend
)
echo ✅ Backend API is ready!

REM Wait for Frontend to be ready
echo 🌐 Waiting for Frontend...
:wait_frontend
curl -f http://localhost:5173 >nul 2>&1
if %errorlevel% neq 0 (
    echo    Frontend is not ready yet...
    timeout /t 5 /nobreak >nul
    goto wait_frontend
)
echo ✅ Frontend is ready!

echo.
echo 🎉 All services are running successfully!
echo.
echo 📊 Service URLs:
echo    🌐 Frontend:     http://localhost:5173
echo    🔧 Backend API:  http://localhost:5000
echo    🍃 MongoDB:      mongodb://localhost:27017
echo    📈 Mongo Express: http://localhost:8081
echo.
echo 🔐 Default Login Credentials:
echo    Email:    admin@sohelgadgets.com
echo    Password: admin123
echo.
echo ⚠️  IMPORTANT: Please change the default password and JWT secret after first login!
echo.
echo 📝 To view logs: docker-compose logs -f [service-name]
echo 🛑 To stop:      docker-compose down
echo 🔄 To restart:   docker-compose restart [service-name]
echo.
pause

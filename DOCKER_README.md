# Sohel Gadgets - Docker Setup Guide

This guide will help you set up and run the Sohel Gadgets Inventory Management System using Docker Compose.

## 🐳 Docker Services

The following services are configured:

- **db**: MongoDB 7.0 database (Port: 27017)
- **backend**: Node.js/Express API (Port: 5000)
- **frontend**: React SPA with Nginx (Port: 5173)
- **mongo-express**: MongoDB web admin interface (Port: 8081)

## 🚀 Quick Start

### Option 1: Automated Startup (Recommended)

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual Commands

1. **Build and start all services:**
```bash
docker-compose up --build -d
```

2. **Check service status:**
```bash
docker-compose ps
```

3. **View logs:**
```bash
docker-compose logs -f
```

## 📊 Access Points

Once services are running, you can access:

- **Frontend Application**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **MongoDB**: mongodb://localhost:27017
- **Mongo Express Admin**: http://localhost:8081

## 🔐 Default Credentials

- **Email**: admin@sohelgadgets.com
- **Password**: admin123
- **MongoDB**: admin / password123

⚠️ **IMPORTANT**: Change these credentials in production!

## 🛠️ Management Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart backend
```

### Rebuild Services
```bash
# Rebuild and restart
docker-compose up --build -d

# Rebuild specific service
docker-compose up --build -d backend
```

### Clean Up
```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a
```

## 🌍 Timezone Configuration

All services are configured to use **Asia/Dhaka** timezone. This affects:
- Database timestamps
- Application logs
- Scheduled tasks

## 📁 Volume Mounts

The following directories are mounted for development:

- `./server/uploads:/app/uploads` - File uploads
- `./server/src:/app/src` - Backend source code
- `./client/src:/app/src` - Frontend source code

Changes to these directories will be reflected immediately in the running containers.

## 🔧 Environment Variables

Key environment variables are configured in `.env.docker`:

- `MONGODB_URI`: Database connection string
- `JWT_SECRET`: JWT authentication secret
- `NODE_ENV`: Application environment
- `TZ`: Timezone setting

## 🏥 Health Checks

All services include health checks:

- **MongoDB**: Uses `mongosh --eval "db.adminCommand('ping')"`
- **Backend**: HTTP check on port 5000
- **Frontend**: HTTP check on port 5173

Services wait for dependencies to be healthy before starting.

## 🐛 Troubleshooting

### Port Conflicts
If ports are already in use, modify them in `docker-compose.yml`:
```yaml
ports:
  - "5001:5000"  # Change backend to 5001
```

### Permission Issues (Linux/Mac)
```bash
sudo chown -R $USER:$USER ./server/uploads
```

### Database Connection Issues
```bash
# Check MongoDB logs
docker-compose logs db

# Test connection
docker-compose exec db mongosh --eval "db.adminCommand('ping')"
```

### Build Failures
```bash
# Clean build
docker-compose down
docker system prune -f
docker-compose up --build -d
```

## 🔄 Development Workflow

1. Make changes to source code
2. Containers automatically pick up changes (due to volume mounts)
3. Restart specific service if needed:
   ```bash
   docker-compose restart backend
   ```

## 📦 Production Deployment

For production deployment:

1. Update `.env.docker` with production values
2. Change default passwords and secrets
3. Remove volume mounts for source code
4. Use proper SSL certificates
5. Set up proper backup strategy

## 📞 Support

If you encounter issues:

1. Check service logs: `docker-compose logs -f`
2. Verify all services are running: `docker-compose ps`
3. Check port availability: `netstat -tulpn | grep :5000`
4. Ensure Docker Desktop is running properly

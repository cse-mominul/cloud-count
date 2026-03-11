#Inventory Management System

A modern, feature-rich inventory management system with dynamic branding, expense management, and role-based access control (RBAC).

## ✨ Features

### 🏢 **Core Features**
- **Dynamic Branding**: Company name, logo, colors, and contact info
- **Professional Invoices**: Modern invoice design with company settings integration
- **Product Management**: Complete CRUD with stock tracking and low stock alerts
- **Customer Management**: Customer database with due tracking
- **Expense Management**: Categorized expense tracking with approval workflow
- **Activity Logging**: Comprehensive audit trail of all system activities

### 🎨 **Advanced Features**
- **Dashboard Analytics**: Business status charts, KPIs, and performance metrics
- **Role-Based Access**: Super Admin, Admin, Manager, and Staff roles
- **PDF Generation**: Professional invoice and report generation
- **Search & Filtering**: Advanced search across all modules
- **Responsive Design**: Mobile-friendly interface with dark theme

### 🔐 **Security & Privacy**
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt encryption for user passwords
- **Privacy Controls**: Profit amounts hidden from customer invoices
- **Activity Audit**: Complete audit trail for compliance

## 🚀 Quick Start with Docker

### Prerequisites
- Docker Engine (20.10+)
- Docker Compose (2.0+)
- Git (for cloning the repository)

### 🐧 Linux Setup

1. **Install Docker**
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd sohel-gadgets
   ```

3. **Start Application**
   ```bash
   # Copy environment file
   cp .env.example .env
   
   # Start all services
   docker-compose up -d
   
   # View logs
   docker-compose logs -f
   ```

4. **Access Application**
   - Frontend: http://localhost
   - Backend API: http://localhost:5000
   - Database: mongodb://localhost:27017

### 🪟 Windows Setup

#### Option 1: Docker Desktop (Recommended)
1. **Install Docker Desktop**
   - Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - Install with WSL 2 backend enabled
   - Restart your computer

2. **Clone Repository**
   ```powershell
   git clone <repository-url>
   cd sohel-gadgets
   ```

3. **Start Application**
   ```powershell
   # Copy environment file
   copy .env.example .env
   
   # Start all services
   docker-compose up -d
   
   # View logs
   docker-compose logs -f
   ```

#### Option 2: WSL2 + Docker CLI
1. **Enable WSL2**
   ```powershell
   wsl --install
   ```

2. **Install Docker in WSL2**
   ```bash
   # In WSL2 Ubuntu terminal
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

3. **Clone and Start**
   ```bash
   git clone <repository-url>
   cd sohel-gadgets
   cp .env.example .env
   docker-compose up -d
   ```

### 📋 Default Credentials

> **⚠️ Important**: Change the default password after first login!

- **Email**: `admin@sohelgadgets.com`
- **Password**: `admin123`
- **Role**: Super Admin

## 🏗️ Architecture

### 📦 Container Services
- **Frontend**: Nginx serving Vite-built React app (Port 80)
- **Backend**: Node.js Express API (Port 5000)
- **Database**: MongoDB 7.0 (Port 27017)

### 🔄 Data Flow
```
Frontend (React) ←→ Backend (Express) ←→ Database (MongoDB)
       ↓                      ↓                    ↓
   User Interface         API Endpoints        Data Storage
```

## 🛠️ Development Setup

### Local Development
1. **Backend Setup**
   ```bash
   cd server
   npm install
   cp .env.example .env
   npm run dev
   ```

2. **Frontend Setup**
   ```bash
   cd client
   npm install
   npm run dev
   ```

### Environment Variables
Create a `.env` file from `.env.example`:

```env
# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/sohel_gadgets?authSource=admin

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Application
NODE_ENV=development
PORT=5000
VITE_API_BASE=http://localhost:5000
```

## 📊 Features Overview

### 🎯 Dashboard
- **Business Status Chart**: 6-month revenue/expense/profit trends
- **KPI Cards**: Total stock, inventory value, low stock alerts
- **Recent Activity**: Last 5 system activities
- **Quick Actions**: Navigation to key modules

### 📦 Inventory Management
- **Product CRUD**: Create, read, update, delete products
- **Stock Tracking**: Real-time stock quantity monitoring
- **Low Stock Alerts**: Automatic alerts for items below threshold
- **Category Management**: Organize products by categories
- **Stock History**: Track all stock movements and changes

### 💰 Financial Management
- **Professional Invoices**: Modern invoice design with company branding
- **Expense Tracking**: Categorized expenses with approval workflow
- **Profit Analysis**: Detailed profit calculation and reporting
- **Customer Dues**: Track and manage customer payments

### 👥 User Management
- **Role-Based Access**: 4-tier permission system
  - **Super Admin**: Full system access and user management
  - **Admin**: All features except user management
  - **Manager**: Product management and sales
  - **Staff**: View products and create sales only
- **Activity Logging**: Complete audit trail
- **Secure Authentication**: JWT-based login system

## 🎨 Customization

### Company Branding
Update company settings in Admin panel:
- Company name and logo
- Contact information (address, phone, email)
- Invoice terms and conditions
- UI colors and theme
- Currency and timezone settings

### Invoice Design
Professional invoice template includes:
- Company header with logo and contact info
- Customer billing information
- Detailed product table with serial numbers
- Payment summary and due amounts
- Dynamic terms and conditions
- Professional footer with contact details

## 🔧 Configuration

### Database Setup
The application automatically:
- Creates MongoDB collections and indexes
- Seeds default Super Admin user
- Initializes company settings
- Sets up proper data relationships

### Security Configuration
- JWT tokens for API authentication
- Password hashing with bcrypt
- Role-based access control
- Activity audit logging
- CORS configuration for API security

## � Forgot Password (OTP) Setup

### Overview
The system includes a secure forgot password feature that uses email-based One-Time Passwords (OTPs) for password reset. Users can reset their passwords through a 3-step process:
1. Enter email address
2. Verify 6-digit OTP sent to email
3. Set new password

### Email Configuration Setup

#### 1. Generate Google App Password
The system uses Gmail for sending OTP emails. Follow these steps to generate an App Password:

1. **Enable 2-Step Verification** (if not already enabled)
   - Go to [Google Account settings](https://myaccount.google.com/)
   - Navigate to Security → 2-Step Verification
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" for the app
   - Select "Other (Custom name)" and enter "Inventory Management System"
   - Click "Generate"
   - Copy the 16-character password (this is your EMAIL_PASS)

#### 2. Configure Environment Variables
Add the following to your `.env` file:

```env
# Email Configuration for OTP
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
```

**Important Notes:**
- Use a Gmail account with 2-Step Verification enabled
- The `EMAIL_PASS` is the App Password, NOT your regular Gmail password
- Keep these credentials secure and never commit them to version control

#### 3. Install Nodemailer (if not already installed)
```bash
cd server
npm install nodemailer
```

### Testing OTP Flow Locally

#### 1. Start the Application
```bash
# Backend
cd server
npm run dev

# Frontend (in another terminal)
cd client
npm run dev
```

#### 2. Test the Complete Flow
1. Navigate to `http://localhost:5173/login`
2. Click "Forgot Password?" link
3. Enter your test email address
4. Check your email for the 6-digit OTP
5. Enter the OTP in the verification step
6. Set your new password
7. Try logging in with the new password

#### 3. Common Issues and Solutions

**Email Not Received:**
- Check spam/junk folders
- Verify EMAIL_USER and EMAIL_PASS are correct
- Ensure 2-Step Verification is enabled
- Generate a new App Password if needed

**Invalid OTP Error:**
- OTP expires after 10 minutes
- Make sure you're entering the latest OTP
- Check for leading/trailing spaces

**SMTP Connection Issues:**
- Verify Gmail credentials
- Check firewall settings
- Ensure port 587 is not blocked

### Security Features
- **OTP Expiration**: 10-minute expiry for security
- **Rate Limiting**: Prevents brute force attacks
- **Email Masking**: Doesn't reveal if email exists
- **Secure Hashing**: New passwords are properly hashed
- **Activity Logging**: All password resets are logged

## � API Documentation

### Authentication Endpoints
```
POST /api/auth/login          - User login
POST /api/auth/register       - User registration
GET  /api/auth/me            - Get current user info
POST /api/auth/forgot-password - Send password reset OTP
POST /api/auth/reset-password - Reset password with OTP
```

### Product Management
```
GET    /api/products           - List all products
POST   /api/products           - Create new product
PUT    /api/products/:id        - Update product
DELETE /api/products/:id        - Delete product
GET    /api/products/low-stock  - Get low stock items
```

### Invoice Management
```
GET    /api/invoices          - List invoices
POST   /api/invoices          - Create invoice
GET    /api/invoices/:id/pdf  - Download invoice PDF
PUT    /api/invoices/:id        - Update invoice
DELETE /api/invoices/:id        - Delete invoice
```

## 🔍 Troubleshooting

### Common Issues

#### Docker Issues
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs frontend

# Restart services
docker-compose restart

# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### Database Connection
```bash
# Check MongoDB connection
docker-compose exec mongodb mongo -u admin -p password123 --authenticationDatabase admin

# Reset database
docker-compose down -v
docker-compose up -d
```

#### Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :80
netstat -tulpn | grep :5000

# Kill conflicting processes
sudo kill -9 <PID>
```

## 📱 Mobile Support

The application is fully responsive and supports:
- **Mobile Phones**: iOS Safari, Android Chrome
- **Tablets**: iPad, Android tablets
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Touch Gestures**: Swipe, pinch-to-zoom
- **Offline Support**: Service worker for basic functionality

## 🔒 Security Best Practices

### Production Deployment
1. **Change Default Password**: Update Super Admin credentials
2. **Environment Variables**: Use strong JWT secret
3. **Database Security**: Enable MongoDB authentication
4. **HTTPS**: Use SSL certificates in production
5. **Regular Updates**: Keep dependencies updated
6. **Backup Strategy**: Regular database backups

### Access Control
- **Principle of Least Privilege**: Users get minimum required access
- **Regular Audits**: Review user permissions regularly
- **Session Management**: Secure token handling
- **Activity Monitoring**: Monitor all user activities

## 📞 Support

### Getting Help
- **Documentation**: Check this README and inline comments
- **Logs**: Review application and container logs
- **Issues**: Report bugs with detailed reproduction steps
- **Community**: Join our developer community

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**🚀 Ready to get started? Follow the quick start guide above!**

For questions or support, please open an issue in the repository.

- `client` - Vite + React SPA (Tailwind, Lucide, React Router, dark/light theme)
- `server` - Express REST API (MongoDB via Mongoose, JWT auth, PDF invoices)

## Features

- Multi‑role authentication (**Admin** and **Staff**)
- Dashboard: total stock, low stock alerts, profit/loss overview
- Product management: add/edit/delete gadgets with stock counts
- Invoice generation with PDF download
- Customer history with previous purchases and outstanding **Due** amounts

## Getting Started

1. Install dependencies

   ```bash
   cd sohel-gadgets

   # Client
   cd client
   npm install

   # Server
   cd ../server
   npm install
   ```

2. Configure environment variables

   In `server`, create a `.env` file based on `.env.example`:

   ```bash
   MONGODB_URI=mongodb://localhost:27017/sohel-gadgets
   JWT_SECRET=replace-with-a-strong-secret
   PORT=5000
   CLIENT_ORIGIN=http://localhost:5173
   ```

3. Run the apps

   ```bash
   # In one terminal
   cd server
   npm run dev

   # In another terminal
   cd client
   npm run dev
   ```

4. Login

   - Visit `http://localhost:5173`
   - Log in with the seeded admin credentials

## Notes

- This project is configured for local development; adjust CORS, HTTPS, and security settings before production use.
- Invoice PDFs are generated on the server and streamed to the browser for download.


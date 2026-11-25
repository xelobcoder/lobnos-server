# Prime Laboratory Software - Distribution Deployment Guide

## Overview
This distribution package contains everything needed to run the PLS application.

## Contents
- dist/ - Compiled application code
- node_modules/ - All dependencies
- scripts/ - Setup and utility scripts
- cert/ - SSL certificates
- public/ - Static assets and uploads
- package.json - Application manifest
- .env - Environment configuration (EDIT THIS!)

## Quick Start

### 1. Configure Environment
Edit the .env file with your database settings:
NODE_ENV=production
PORT=5000
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=primetenant1
JWT_SECRET=your_secret_key_here

### 2. Run the Application

#### Windows (as Service - Recommended)
npm run service:install:win

#### Linux/Mac (Direct)
npm run kill-port
node --env-file=./.env ./dist/src/app.js

## Available npm Scripts

### Application Control
- npm run kill-port - Kill process on port 5000
- npm run start - Start application

### Windows Service
- npm run service:install:win - Install as Windows service
- npm run service:uninstall:win - Remove from Windows
- npm run service:start:win - Start the service
- npm run service:stop:win - Stop the service
- npm run service:restart:win - Restart the service

## Troubleshooting

### Port Already in Use
npm run kill-port

### Database Connection Issues
1. Verify MySQL/MariaDB is running
2. Check .env database credentials
3. Ensure database user has necessary permissions

### Certificate Issues
SSL certificates should be in cert/ directory:
- cert/server.cert - Server certificate
- cert/server.key - Private key (keep secure!)

## Security Notes
1. Change JWT_SECRET in .env to a secure random value
2. Use strong database passwords
3. Store .env securely - never commit to version control
4. Enable SSL/TLS in production
5. Regularly backup your database

---
Prime Laboratory Software

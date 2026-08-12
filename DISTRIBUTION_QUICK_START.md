# Distribution Package - Quick Start

## TL;DR - Get Running in 3 Steps

### 1. Create Distribution Package

```bash
npm run create-distribution
```

This creates a `distribution/` folder with everything needed.

### 2. Configure & Deploy

- Copy the `distribution/` folder to your target server/machine
- Edit `distribution/.env` with your database and settings

### 3. Run Application

**Windows:**

```powershell
cd distribution
npm run service:install:win
```

**Linux/Mac:**

```bash
cd distribution
npm run kill-port
npm run start
```

---

## Full Deployment Checklist

### Before Creating Distribution

- [ ] All source code is complete and tested
- [ ] No uncommitted changes in `.env` or sensitive files
- [ ] Database schema is up to date
- [ ] SSL certificates are in `cert/` folder
- [ ] All dependencies installed: `npm install`

### Create Distribution

```bash
# Compiles TypeScript, packages everything
npm run create-distribution
```

### After Distribution is Created

- [ ] Verify package: `npm run verify-distribution` (from distribution folder)
- [ ] Check all files present in `distribution/` folder
- [ ] Review `.env` template - edit with production values
- [ ] Test on target machine:
  - [ ] Extract distribution
  - [ ] Edit `.env`
  - [ ] Run startup script
  - [ ] Verify application starts

### Deploy to Production

- [ ] Compress distribution: `zip -r pls-distribution.zip distribution/`
- [ ] Transfer to production server
- [ ] Extract and follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [ ] Install as Windows service OR run as background process
- [ ] Verify logs and functionality

---

## What's in the Distribution

```
distribution/
├── dist/                    # Compiled TypeScript → JavaScript
├── node_modules/            # All npm dependencies (preinstalled)
├── scripts/                 # Setup and utility scripts
├── cert/                    # SSL certificates
├── public/                  # Static files and upload directories
├── package.json             # npm manifest with all scripts
├── .env                     # Configuration (EDIT THIS!)
├── knexfile.ts              # Database connection config
├── DEPLOYMENT_GUIDE.md      # Complete setup instructions
└── verify-distribution.js   # Validation script
```

**Total Size:** ~300-500 MB (mostly node_modules)

---

## For Different Scenarios

### Scenario: Send to Client

1. `npm run create-distribution`
2. `zip -r pls-distribution.zip distribution/`
3. Send ZIP file to client
4. Client extracts and follows DEPLOYMENT_GUIDE.md

### Scenario: Deploy to Cloud (AWS/Azure/GCP)

1. `npm run create-distribution`
2. `npm run verify-distribution`
3. Upload `distribution/` to cloud storage
4. Deploy on cloud VM:
   ```bash
   unzip pls-distribution.zip
   cd distribution
   # Edit .env with cloud database details
   npm run kill-port
   node --env-file=./.env ./dist/src/app.js &
   ```

### Scenario: Docker Containerization

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY distribution/ .
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "--env-file=./.env", "./dist/src/app.js"]
```

### Scenario: Windows Server Installation

1. Extract distribution to `C:\PLS\`
2. Edit `C:\PLS\distribution\.env`
3. Open PowerShell as Administrator in `C:\PLS\distribution`
4. Run: `npm run service:install:win`
5. Service starts automatically on system boot

---

## Troubleshooting Distribution

### Distribution won't build

```bash
# Ensure TypeScript compiles first
npm run build

# Then try distribution again
npm run create-distribution
```

### Verification fails

```bash
# From distribution folder, manually check
node verify-distribution.js

# Look for missing files and copy them manually
```

### Application won't start after deployment

1. Check `.env` file has correct database credentials
2. Ensure MySQL/MariaDB is running and accessible
3. Check logs for errors: `node --env-file=./.env ./dist/src/app.js`
4. Verify port 5000 isn't already in use: `npm run kill-port`

### Size is too large

- `node_modules/` can be ~400MB
- Exclude from distribution and install on target: `npm ci --omit=dev`
- Compress before transfer: `tar -czf pls-distribution.tar.gz distribution/`

---

## What NOT to Modify in Distribution

❌ DON'T edit compiled code in `dist/`
❌ DON'T modify `package.json` structure
❌ DON'T remove `node_modules` without reinstalling
❌ DON'T copy `.env` to version control

✅ DO edit `.env` with your settings
✅ DO add files to `public/uploads/` as needed
✅ DO create backups of your database
✅ DO update dependencies in source and rebuild

---

## Scripts Available in Distribution

### Application Control

```bash
npm run kill-port              # Kill process using port 5000
npm run start                  # Start application (Windows service or direct)
```

### Windows Service (Windows only)

```bash
npm run service:install:win    # Install as Windows service
npm run service:uninstall:win  # Remove from Windows
npm run service:start:win      # Start the service
npm run service:stop:win       # Stop the service
npm run service:restart:win    # Restart the service
npm run service:status:win     # Check if running
```

### Utilities

```bash
npm run verify-distribution    # Validate package integrity
```

---

## Next Steps

1. **Create distribution:** `npm run create-distribution`
2. **Test locally:** Copy `distribution/` folder and test
3. **Deploy:** Follow [DEPLOYMENT_GUIDE.md](docs/DISTRIBUTION_BUILD_GUIDE.md)
4. **Monitor:** Check logs and verify functionality

For complete deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

**Distribution System v1.0**  
Prime Lab System (PLS)

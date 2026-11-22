# Distribution Build Instructions

## Overview

The distribution build creates a complete, self-contained folder with everything needed to run the PLS (Prime Laboratory Software) application on a clean machine without requiring the source code or additional downloads.

## What's Included in Distribution

- ✅ Compiled application code (`dist/`)
- ✅ All npm dependencies (`node_modules/`)
- ✅ Configuration files (`package.json`, `.env`)
- ✅ Setup scripts (Windows service, backup scheduler)
- ✅ Database configuration (`knexfile.ts`)
- ✅ SSL certificates (`cert/`)
- ✅ Static assets (`public/`)
- ✅ Deployment guide and verification tools

## Building the Distribution

### On Windows (Recommended)

```bash
npm run create-distribution:win
```

Or manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/create-distribution.bat
```

### On Linux/Mac

```bash
npm run create-distribution:linux
```

Or manually:

```bash
bash ./scripts/create-distribution.sh
```

### Cross-Platform (Node.js)

```bash
npm run create-distribution
```

## Output

The build creates a `distribution/` folder in the project root with this structure:

```
distribution/
├── dist/                          # Compiled application
├── node_modules/                  # All dependencies
├── scripts/
│   ├── backup-scheduler.js
│   └── windows/
│       ├── install-service.ps1
│       ├── uninstall-service.ps1
│       ├── service-control.ps1
│       └── install-nssm.ps1
├── cert/                          # SSL certificates
├── public/                        # Static files
├── package.json                   # Application manifest
├── .env                          # Environment config (edit this!)
├── knexfile.ts                   # Database config
├── DEPLOYMENT_GUIDE.md           # Detailed setup instructions
├── verify-distribution.js        # Verification script
└── README.md                     # This guide
```

## Deployment Steps

### 1. Extract Distribution

Copy the `distribution/` folder to your deployment target machine.

### 2. Edit Configuration

Edit `.env` with your production settings:

```env
NODE_ENV=production
DB_HOST=your_database_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET=your_secure_random_secret
# ... other settings
```

### 3. Verify Distribution (Optional)

```bash
npm run verify-distribution
```

Or manually run:

```bash
node verify-distribution.js
```

### 4. Install & Run

**Windows Service (Recommended for Production):**

```powershell
npm run service:install:win
```

**Linux/Mac Direct:**

```bash
npm run kill-port
node --env-file=./.env ./dist/src/app.js
```

## What Gets Copied

### Directories

- `dist/` - Full compiled application
- `scripts/` - All utility and setup scripts
- `cert/` - SSL certificates
- `public/` - Static assets and uploads directory
- `node_modules/` - All dependencies (pruned of test files and maps)

### Files

- `package.json` - Dependencies and scripts manifest
- `package-lock.json` - Locked dependency versions (if exists)
- `knexfile.ts` - Database connection configuration
- `.env` - Environment variables (auto-created with template if missing)

### Generated Files

- `DEPLOYMENT_GUIDE.md` - Complete setup and troubleshooting guide
- `verify-distribution.js` - Distribution verification tool

## Verification

### Manual Checks

Before shipping the distribution, verify these files exist:

- [ ] `dist/src/app.js` - Main application entry point
- [ ] `dist/src/start.js` - Startup script
- [ ] `node_modules/express/` - Core dependency
- [ ] `scripts/windows/install-service.ps1` - Service installer
- [ ] `package.json` - Has all required npm scripts
- [ ] `.env` - Environment template is present
- [ ] `cert/server.cert` - SSL certificate

### Automated Check

```bash
npm run verify-distribution
```

## Customization

### Excluding Extra Files

Edit the `EXCLUDE_PATTERNS` array in `scripts/create-distribution.js` to skip additional files:

```javascript
const EXCLUDE_PATTERNS = [
  /node_modules\/.*\.(test|spec)\.(js|ts)$/,
  /\.map$/,
  // Add more patterns here
];
```

### Adding Files

To include additional files or directories, modify the `INCLUDE_DIRS` and `INCLUDE_FILES` arrays:

```javascript
const INCLUDE_DIRS = [
  "dist",
  "scripts",
  "cert",
  "public",
  "node_modules",
  "migrations", // Add any new directory
];
```

## Size Optimization

### Typical Size Breakdown

- `dist/` - 5-15 MB (compiled code)
- `node_modules/` - 300-500 MB (all dependencies)
- `scripts/` - < 1 MB
- `cert/` - < 1 MB
- `public/` - 1-50 MB (depends on assets)

### Reducing Size

1. **Remove unnecessary node_modules packages** - Edit package.json before building
2. **Exclude development dependencies** - Use `npm ci --omit=dev`
3. **Remove node_modules and reinstall on target** - Provide separate `node_modules` installation instructions
4. **Compress distribution** - Zip the folder before transfer

## Troubleshooting

### "dist/ not found"

Solution: Ensure `npm run build` completes successfully:

```bash
npm run build
npm run create-distribution
```

### "node_modules missing"

Solutions:

1. Run `npm install` first:
   ```bash
   npm install
   npm run create-distribution
   ```
2. Or exclude node_modules from distribution and include `npm install` in deployment instructions

### ".env not created"

The script auto-generates a template. If missing, create manually:

```bash
cp .env.example distribution/.env
```

### Distribution script fails on Linux

Make script executable:

```bash
chmod +x scripts/create-distribution.sh
npm run create-distribution:linux
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Build Distribution
  run: npm run create-distribution

- name: Verify Distribution
  run: npm run verify-distribution

- name: Upload Distribution
  uses: actions/upload-artifact@v3
  with:
    name: pls-distribution
    path: distribution/
```

### Automation in Pipelines

```bash
#!/bin/bash
npm ci
npm run build
npm run create-distribution
npm run verify-distribution
tar -czf pls-distribution.tar.gz distribution/
```

## Security Considerations

⚠️ **IMPORTANT:**

1. **Change .env secrets** - Never use template values in production
2. **Remove source code** - Distribution contains compiled code only
3. **Secure certificates** - Ensure SSL certs are production-grade
4. **Review dependencies** - Check `npm audit` for vulnerabilities
5. **Limit access** - Restrict distribution folder access on deployment servers

## Support

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) in the distribution folder.

---

**Distribution Build v1.0**  
Prime Laboratory Software

## Required facility provisioning exports

Run `pnpm create-distribution` from `lobnos-server` (hyphenated command).
The package must include `db-exports/primelabmaster/tables-structure` (288 SQL files)
and `db-exports/primelabmaster/seeds` (9 catalogue SQL files), beside `dist`.
All distribution builders now check these assets before packaging and after copying.

For an already copied installation reporting “Required facility structure assets are missing”,
copy the complete `db-exports/primelabmaster` folder from the matching release into the
installed backend's `db-exports/primelabmaster`, then run:

```sh
node scripts/verify-distribution-exports.js
```

Restart the backend and retry facility provisioning. These files are provisioning inputs;
copying them does not require importing a dump over an existing tenant database.

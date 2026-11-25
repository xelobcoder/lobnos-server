#!/usr/bin/env node

/**
 * Distribution Package Creator
 * Creates a complete, self-contained distribution folder with all necessary files
 * to run the PLS (Prime Laboratory Software) application
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DISTRIBUTION_DIR = path.join(__dirname, "..", "distribution");
const PROJECT_ROOT = path.join(__dirname, "..");

// Directories and files to include in distribution
const INCLUDE_DIRS = [
  "db-exports", // Required facility provisioning structure and catalogue SQL
  "dist", // Compiled application
  "scripts", // Setup and utility scripts
  "cert", // SSL certificates
  "public", // Static assets
  //   "node_modules", // Dependencies
];

const INCLUDE_FILES = [
  "package.json", // Dependencies and scripts
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "package-lock.json", // Locked versions
  ".env.example", // Environment template
  "knexfile.ts", // Database configuration
];

// Files that should NOT be included
const EXCLUDE_PATTERNS = [
  /scripts[\\/]licensing(?:[\\/]|$)/, // Issuer workstation tools must never ship to customers.
  /node_modules\/.*\.(test|spec)\.(js|ts)$/,
  /node_modules\/.*\.map$/,
  /\.git/,
  /\.gitignore/,
  /^src[\\/]/,
  /tsconfig/,
  /FlowCharts/,
  /backups/,
];

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath) {
  const relative = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(relative));
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest, isNodeModules = false) {
  if (!fs.existsSync(src)) {
    console.warn("WARNING: Source directory does not exist: " + src);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  entries.forEach((entry) => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded files
    if (shouldExclude(srcPath)) {
      return;
    }

    // Skip common node_modules patterns we don't need
    if (isNodeModules && ["test", "tests", ".bin"].includes(entry.name)) {
      return;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, isNodeModules);
    } else {
      // Skip large unnecessary files in node_modules
      if (
        isNodeModules &&
        (entry.name.endsWith(".map") || entry.name === "LICENSE")
      ) {
        return;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

/**
 * Copy single file
 */
function copyFile(src, dest) {
  const srcPath = path.join(PROJECT_ROOT, src);
  const destPath = path.join(DISTRIBUTION_DIR, src);

  if (!fs.existsSync(srcPath)) {
    console.warn("WARNING: File does not exist: " + src);
    return;
  }

  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(srcPath, destPath);
}

/**
 * Create .env template if not exists
 */
function createEnvTemplate() {
  const envPath = path.join(DISTRIBUTION_DIR, ".env");
  const envExamplePath = path.join(PROJECT_ROOT, ".env");

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
    } else {
      // Create a minimal template
      const envContent = `# Prime Laboratory Software Environment Configuration
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=primetenant1
JWT_SECRET=your_jwt_secret_here
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=info
`;
      fs.writeFileSync(envPath, envContent);
    }
  }
}

/**
 * Create deployment README
 */
function createDeploymentGuide() {
  const scriptPath = path.join(DISTRIBUTION_DIR, "DEPLOYMENT_GUIDE.md");
  if (fs.existsSync(scriptPath)) {
    return; // Already exists, skip
  }

  const content = `# Prime Laboratory Software - Distribution Deployment Guide

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
`;

  fs.writeFileSync(scriptPath, content);
}

/**
 * Create startup verification script
 */
function createVerificationScript() {
  const scriptPath = path.join(DISTRIBUTION_DIR, "verify-distribution.js");
  if (fs.existsSync(scriptPath)) {
    return; // Already exists, skip
  }

  fs.copyFileSync(path.join(__dirname, 'verify-distribution.js'), scriptPath);
  fs.chmodSync(scriptPath, 0o755);
}

/**
 * Main execution
 */
function main() {
  console.log("Creating PLS Distribution Package...\\n");

  require("./verify-distribution-exports").verifyExports(PROJECT_ROOT);

  // Step 1: Build the application
  console.log("Step 1: Compiling TypeScript...");
  try {
    execSync("npm run build", { cwd: PROJECT_ROOT, stdio: "inherit" });
    console.log("TypeScript compilation complete\\n");
  } catch (error) {
    console.error("ERROR: TypeScript compilation failed");
    process.exit(1);
  }

  // Step 2: Clean distribution directory
  console.log("Step 2: Cleaning distribution directory...");
  if (fs.existsSync(DISTRIBUTION_DIR)) {
    fs.rmSync(DISTRIBUTION_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DISTRIBUTION_DIR, { recursive: true });
  console.log("Directory cleaned\\n");

  // Step 3: Copy directories
  console.log("Step 3: Copying application files...");
  INCLUDE_DIRS.forEach((dir) => {
    const srcPath = path.join(PROJECT_ROOT, dir);
    const destPath = path.join(DISTRIBUTION_DIR, dir);

    if (fs.existsSync(srcPath)) {
      console.log("  Copying " + dir + "...");
      const isNodeModules = dir === "node_modules";
      copyDir(srcPath, destPath, isNodeModules);
    }
  });
  require("./verify-distribution-exports").verifyExports(DISTRIBUTION_DIR);
  console.log("Application files copied\\n");

  // Step 4: Copy configuration files
  console.log("Step 4: Copying configuration files...");
  INCLUDE_FILES.forEach((file) => {
    if (fs.existsSync(path.join(PROJECT_ROOT, file))) {
      copyFile(file);
      console.log("  OK: " + file);
    }
  });
  console.log("");

  // Step 5: Create environment file
  console.log("Step 5: Setting up environment...");
  createEnvTemplate();
  console.log("");

  // Step 6: Create documentation
  console.log("Step 6: Creating deployment guide...");
  createDeploymentGuide();
  console.log("");

  // Step 7: Create verification script
  console.log("Step 7: Creating verification script...");
  createVerificationScript();
  console.log("");

  // Step 8: Verify distribution
  console.log("Installing production dependencies into the package...");
  execSync("pnpm install --prod --frozen-lockfile --ignore-scripts --config.node-linker=hoisted", { cwd: DISTRIBUTION_DIR, stdio: "inherit" });
  console.log("Step 8: Verifying distribution...");
  const result = require('child_process').spawnSync(process.execPath, [path.join(DISTRIBUTION_DIR, 'verify-distribution.js')], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Distribution verification failed');
}
if (require.main === module) main();
module.exports = {copyDir, shouldExclude};

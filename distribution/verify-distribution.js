#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REQUIRED_DIRS = [
  'dist',
  'node_modules',
  'scripts',
  'public',
];

const REQUIRED_FILES = [
  'package.json',
  '.env',
  'knexfile.ts',
];

console.log('Verifying distribution package...\n');

let allGood = true;

// Check directories
console.log('Checking required directories:');
REQUIRED_DIRS.forEach(dir => {
  const exists = fs.existsSync(dir);
  const status = exists ? 'OK' : 'MISSING';
  console.log('  [' + status + '] ' + dir);
  if (!exists) allGood = false;
});

console.log('\nChecking required files:');
REQUIRED_FILES.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? 'OK' : 'MISSING';
  console.log('  [' + status + '] ' + file);
  if (!exists) allGood = false;
});

// Check critical compiled files
console.log('\nChecking critical compiled files:');
const criticalFiles = [
  'dist/src/app.js',
  'dist/src/start.js',
];
criticalFiles.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? 'OK' : 'MISSING';
  console.log('  [' + status + '] ' + file);
  if (!exists) allGood = false;
});

if (allGood) {
  console.log('\nDistribution package is complete and ready to deploy!');
  process.exit(0);
} else {
  console.log('\nSome files are missing. Check paths above.');
  process.exit(1);
}

#!/bin/bash

# Distribution Package Creator (Linux/Mac)
# Creates a complete, self-contained distribution folder

set -e

DISTRIBUTION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/distribution"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Creating PLS Distribution Package..."
echo ""

# Step 1: Build the application
echo "📦 Step 1: Compiling TypeScript..."
cd "$PROJECT_ROOT"
npm run build
echo "✅ TypeScript compilation complete"
echo ""

# Step 2: Clean distribution directory
echo "🧹 Step 2: Cleaning distribution directory..."
rm -rf "$DISTRIBUTION_DIR"
mkdir -p "$DISTRIBUTION_DIR"
echo "✅ Directory cleaned"
echo ""

# Step 3: Copy directories
echo "📂 Step 3: Copying application files..."

copy_dir() {
  local src="$1"
  local dest="$2"
  if [ -d "$src" ]; then
    echo "  Copying $(basename "$src")..."
    cp -r "$src" "$dest"
  fi
}

copy_dir "$PROJECT_ROOT/dist" "$DISTRIBUTION_DIR/dist"
copy_dir "$PROJECT_ROOT/scripts" "$DISTRIBUTION_DIR/scripts"
copy_dir "$PROJECT_ROOT/cert" "$DISTRIBUTION_DIR/cert" 2>/dev/null || true
copy_dir "$PROJECT_ROOT/public" "$DISTRIBUTION_DIR/public" 2>/dev/null || true
copy_dir "$PROJECT_ROOT/node_modules" "$DISTRIBUTION_DIR/node_modules" 2>/dev/null || true

echo "✅ Application files copied"
echo ""

# Step 4: Copy configuration files
echo "📋 Step 4: Copying configuration files..."
cp "$PROJECT_ROOT/package.json" "$DISTRIBUTION_DIR/package.json"
echo "  ✅ package.json"

if [ -f "$PROJECT_ROOT/package-lock.json" ]; then
  cp "$PROJECT_ROOT/package-lock.json" "$DISTRIBUTION_DIR/package-lock.json"
  echo "  ✅ package-lock.json"
fi

if [ -f "$PROJECT_ROOT/knexfile.ts" ]; then
  cp "$PROJECT_ROOT/knexfile.ts" "$DISTRIBUTION_DIR/knexfile.ts"
  echo "  ✅ knexfile.ts"
fi

echo ""

# Step 5: Create environment file
echo "🔐 Step 5: Setting up environment..."
if [ ! -f "$DISTRIBUTION_DIR/.env" ]; then
  if [ -f "$PROJECT_ROOT/.env" ]; then
    cp "$PROJECT_ROOT/.env" "$DISTRIBUTION_DIR/.env"
  else
    cat > "$DISTRIBUTION_DIR/.env" << 'EOF'
# Prime Lab System Environment Configuration
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
EOF
  fi
fi
echo "✅ Environment file ready"
echo ""

echo "✅ Distribution package created at: $DISTRIBUTION_DIR"
echo "📚 Read DEPLOYMENT_GUIDE.md for setup instructions"

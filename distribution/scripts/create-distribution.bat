@echo off
REM Distribution Package Creator (Windows Batch)
REM Creates a complete, self-contained distribution folder

setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0.."
set "DISTRIBUTION_DIR=%PROJECT_ROOT%\distribution"

echo 🚀 Creating PLS Distribution Package...
echo.

REM Step 1: Build the application
echo 📦 Step 1: Compiling TypeScript...
cd /d "%PROJECT_ROOT%"
call npm run build
if errorlevel 1 (
    echo ❌ TypeScript compilation failed
    exit /b 1
)
echo ✅ TypeScript compilation complete
echo.

REM Step 2: Clean distribution directory
echo 🧹 Step 2: Cleaning distribution directory...
if exist "%DISTRIBUTION_DIR%" (
    rmdir /s /q "%DISTRIBUTION_DIR%"
)
mkdir "%DISTRIBUTION_DIR%"
echo ✅ Directory cleaned
echo.

REM Step 3: Copy directories
echo 📂 Step 3: Copying application files...

if exist "%PROJECT_ROOT%\dist" (
    echo   Copying dist...
    xcopy "%PROJECT_ROOT%\dist" "%DISTRIBUTION_DIR%\dist" /E /I /Q
)

if exist "%PROJECT_ROOT%\scripts" (
    echo   Copying scripts...
    xcopy "%PROJECT_ROOT%\scripts" "%DISTRIBUTION_DIR%\scripts" /E /I /Q
)

if exist "%PROJECT_ROOT%\cert" (
    echo   Copying cert...
    xcopy "%PROJECT_ROOT%\cert" "%DISTRIBUTION_DIR%\cert" /E /I /Q
)

if exist "%PROJECT_ROOT%\public" (
    echo   Copying public...
    xcopy "%PROJECT_ROOT%\public" "%DISTRIBUTION_DIR%\public" /E /I /Q
)

if exist "%PROJECT_ROOT%\node_modules" (
    echo   Copying node_modules...
    xcopy "%PROJECT_ROOT%\node_modules" "%DISTRIBUTION_DIR%\node_modules" /E /I /Q /Y
)

echo ✅ Application files copied
echo.

REM Step 4: Copy configuration files
echo 📋 Step 4: Copying configuration files...
if exist "%PROJECT_ROOT%\package.json" (
    copy "%PROJECT_ROOT%\package.json" "%DISTRIBUTION_DIR%\package.json" >nul
    echo   ✅ package.json
)

if exist "%PROJECT_ROOT%\package-lock.json" (
    copy "%PROJECT_ROOT%\package-lock.json" "%DISTRIBUTION_DIR%\package-lock.json" >nul
    echo   ✅ package-lock.json
)

if exist "%PROJECT_ROOT%\knexfile.ts" (
    copy "%PROJECT_ROOT%\knexfile.ts" "%DISTRIBUTION_DIR%\knexfile.ts" >nul
    echo   ✅ knexfile.ts
)

echo.

REM Step 5: Create environment file
echo 🔐 Step 5: Setting up environment...
if not exist "%DISTRIBUTION_DIR%\.env" (
    if exist "%PROJECT_ROOT%\.env" (
        copy "%PROJECT_ROOT%\.env" "%DISTRIBUTION_DIR%\.env" >nul
    ) else (
        (
            echo # Prime Lab System Environment Configuration
            echo NODE_ENV=production
            echo PORT=5000
            echo DB_HOST=localhost
            echo DB_PORT=3306
            echo DB_USER=root
            echo DB_PASSWORD=
            echo DB_NAME=primetenant1
            echo JWT_SECRET=your_jwt_secret_here
            echo REDIS_HOST=localhost
            echo REDIS_PORT=6379
            echo LOG_LEVEL=info
        ) > "%DISTRIBUTION_DIR%\.env"
    )
)
echo ✅ Environment file ready
echo.

REM Create deployment guide
echo 📚 Step 6: Creating deployment guide...
call node "%PROJECT_ROOT%\scripts\create-distribution.js" 2>nul || (
    echo   Note: Run 'npm run create-distribution' manually for full setup
)

echo.
echo ✅ Distribution package created at: %DISTRIBUTION_DIR%
echo 📚 Read DEPLOYMENT_GUIDE.md in the distribution folder for setup instructions
echo.
pause

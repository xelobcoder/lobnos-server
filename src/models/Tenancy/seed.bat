@echo off

REM Parameters
set DB_HOST=%1
set DB_PORT=%2
set DB_USER=%3
set DB_PASSWORD=%4
set DB_NAME=%5

REM Path to the SQL seed file
set SEED_FILE=%~dp0..\migrations\Seeds\limsdbTenantSeed.sql

REM Check if the SQL file exists
if not exist "%SEED_FILE%" (
    echo Error: Seed file not found at %SEED_FILE%
    exit /b 1
)

REM Load the seed data into the database
mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% < "%SEED_FILE%"

if %errorlevel% equ 0 (
    echo Seed data loaded successfully into database %DB_NAME%.
) else (
    echo Error: Failed to load seed data into database %DB_NAME%.
    exit /b 1
)
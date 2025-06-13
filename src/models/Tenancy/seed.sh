#!/bin/bash

# Parameters
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Barcelona45##
DB_NAME=primetenant1

# Path to the SQL seed file
SEED_FILE="F:/PROJECTS/LobnosProfessionalVersion/lobnos-server/dist/migrations/Seeds/limsdbTenantSeed.sql"

# Check if the SQL file exists
if [ ! -f "$SEED_FILE" ]; then
    echo "Error: Seed file not found at $SEED_FILE"
    exit 1
fi

# Load the seed data into the database
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < $SEED_FILE

if [ $? -eq 0 ]; then
    echo "Seed data loaded successfully into database $DB_NAME."
else
    echo "Error: Failed to load seed data into database $DB_NAME."
    exit 1
fi
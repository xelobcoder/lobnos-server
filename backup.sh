#!/bin/bash

# Change directory to where MySQL is installed
cd 'C:\xampp\mysql\bin'

# Define the storage directory for the backup
backup_dir='C:\backup'

# Define the filename with timestamp
timestamp=$(date +"%Y%m%d%H%M%S")
backup_file="$backup_dir/limsdb_$timestamp.sql"

# Perform the backup using mysqldump
./mysqldump -u root limsdb > $backup_file

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Database backup completed successfully. Backup saved to: $backup_file"
else
    echo "Error: Database backup failed."
fi

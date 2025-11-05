# Database Backup System

## Overview

This system provides comprehensive database and file backup functionality with logging and monitoring capabilities. It supports both automated and manual backups, tracks backup success/failure, and stores detailed metadata about each backup operation.

## Features

- **Database Backups**: Full database dumps using native database tools (MySQL/PostgreSQL)
- **File Backups**: Compressed archives of file directories
- **Backup Logging**: Complete audit trail of all backup operations
- **Backup Statistics**: Monitoring and reporting on backup success rates
- **Flexible Storage**: Backups can be stored in any specified directory
- **Multi-tenant Support**: Tenant-specific backup operations

## Database Schema

### backup_logs Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (Primary Key) | Unique backup identifier |
| backup_name | VARCHAR | Human-readable backup name |
| is_successful | BOOLEAN | Whether the backup completed successfully |
| is_full_backup | BOOLEAN | Whether this is a full system backup |
| backup_size_bytes | BIGINT | Size of backup file in bytes |
| backup_type | ENUM | Type: 'database', 'files', 'full_system' |
| backup_mode | ENUM | Mode: 'automated', 'manual' |
| backup_date | DATETIME | When the backup was created |
| backup_path | VARCHAR | Full path to backup file |
| error_message | TEXT | Error details if backup failed |
| duration_seconds | INTEGER | How long the backup took |
| created_by | VARCHAR | User who initiated the backup |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Record update timestamp |

## API Endpoints

### Create Database Backup
```
POST /api/v1/security-features/backup/database
```

**Request Body:**
```json
{
  "backupName": "daily_backup_2025_11_05",
  "backupPath": "/path/to/backup/directory",
  "isFullBackup": true,
  "backupMode": "manual",
  "createdBy": "admin_user"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Database backup completed successfully",
  "data": {
    "backupPath": "/path/to/backup/directory/daily_backup_2025_11_05_2025-11-05T10-00-00.sql",
    "size": 1048576,
    "duration": 45
  }
}
```

### Create File Backup
```
POST /api/v1/security-features/backup/files
```

**Request Body:**
```json
{
  "backupName": "uploads_backup",
  "sourcePath": "/path/to/source/directory",
  "backupPath": "/path/to/backup/directory",
  "backupMode": "manual",
  "createdBy": "admin_user"
}
```

### Get Backup Logs
```
GET /api/v1/security-features/backup/logs
```

**Query Parameters:**
- `is_successful`: Filter by success status (true/false)
- `backup_type`: Filter by type (database/files/full_system)
- `backup_mode`: Filter by mode (automated/manual)
- `limit`: Number of records to return (default: 50)
- `offset`: Pagination offset (default: 0)

### Get Backup Statistics
```
GET /api/v1/security-features/backup/stats
```

**Response:**
```json
{
  "status": true,
  "data": {
    "total_backups": 25,
    "successful_backups": 23,
    "failed_backups": 2,
    "total_size": 52428800,
    "last_backup_date": "2025-11-05T10:00:00.000Z"
  }
}
```

### Get Specific Backup
```
GET /api/v1/security-features/backup/logs/:id
```

### Delete Backup Log
```
DELETE /api/v1/security-features/backup/logs/:id
```

## Usage Examples

### Manual Database Backup
```bash
curl -X POST "http://localhost:5000/api/v1/security-features/backup/database?tenantId=1" \
  -H "Content-Type: application/json" \
  -d '{
    "backupName": "manual_backup",
    "backupPath": "/var/backups/database",
    "isFullBackup": true,
    "backupMode": "manual",
    "createdBy": "admin"
  }'
```

### Automated File Backup
```javascript
const result = await BackupManager.performFileBackup(
  tenantId,
  'automated_files_backup',
  '/var/www/uploads',
  '/var/backups/files',
  'automated',
  'system'
);
```

### Check Backup Statistics
```javascript
const stats = await BackupManager.getBackupStats(tenantId);
console.log(`Success rate: ${(stats.successful_backups / stats.total_backups * 100).toFixed(1)}%`);
```

## Supported Databases

### MySQL/MariaDB
- Uses `mysqldump` command
- Supports authentication and custom ports
- Generates SQL dump files

### PostgreSQL
- Uses `pg_dump` command
- Supports authentication and custom ports
- Generates SQL dump files

## File Backup

- Uses `tar` command with gzip compression
- Creates `.tar.gz` archives
- Preserves file permissions and structure

## Error Handling

- Failed backups are logged with error messages
- Duration tracking for performance monitoring
- Automatic cleanup of failed backup attempts

## Security Considerations

- Backup files contain sensitive data - ensure secure storage
- File permissions should restrict access to backup directories
- Consider encryption for backup files in production
- Regular cleanup of old backup files

## Monitoring

- Track backup success rates
- Monitor backup file sizes
- Alert on failed backups
- Review backup duration trends

## Maintenance

### Regular Cleanup
```sql
-- Delete backup logs older than 90 days
DELETE FROM backup_logs
WHERE backup_date < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### Storage Management
- Implement backup rotation policies
- Monitor disk space usage
- Set up automated cleanup scripts

## Migration

Run the migration to create the backup_logs table:
```bash
npm run knex migrate:latest
```

The migration file: `20251105100000_create_backup_logs_table.ts`
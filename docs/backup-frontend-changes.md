# Backup Frontend API Contract

This is the exact payload and response contract for current backup/security endpoints.

## Global Rule

Backend requests use tenantId from the authenticated session. Browser downloads
use the same-origin API proxy, which supplies the session tenant; do not use a
build-time public tenant ID to select another tenant.

Example:

- /api/v1/security-features/backup/schedules?tenantId=1

Common error shape:

```json
{
  "status": false,
  "error": "message"
}
```

Validation error shape:

```json
{
  "status": false,
  "error": "Validation failed",
  "details": ["field message", "field message"]
}
```

## 1) Security Settings

### GET /api/v1/security-features/backup/security-settings

Request body: none

Success 200:

```json
{
  "status": true,
  "data": {
    "id": 1,
    "encryption_enabled": false,
    "encryption_algorithm": "AES-256",
    "encryption_password": "StrongPass123!",
    "key_rotation_days": 90,
    "secure_deletion_enabled": false,
    "deletion_passes": 1,
    "storage_path": "D:/backups",
    "current_key_id": "KEY-2026-001",
    "key_last_rotated": "2026-08-12",
    "is_active": true,
    "created_at": "2026-08-12T10:00:00.000Z",
    "updated_at": "2026-08-12T10:00:00.000Z"
  }
}
```

### PUT /api/v1/security-features/backup/security-settings

Request payload (all optional, partial update):

```json
{
  "storage_path": "D:/backups",
  "encryption_password": "StrongPass123!",
  "encryption_algorithm": "AES-256",
  "key_rotation_days": 90,
  "secure_deletion_enabled": true,
  "deletion_passes": 3,
  "encryption_enabled": true
}
```

Success 200:

```json
{
  "status": true,
  "message": "Security settings updated successfully"
}
```

UI behavior rule:

- If encryption_password is non-empty, backup files are encrypted.
- If encryption_password is empty or null, backup files are not encrypted.

## 2) Manual Database Backup

### POST /api/v1/security-features/backup/database

Request payload:

```json
{
  "backupName": "nightly_backup",
  "isFullBackup": true,
  "backupMode": "manual",
  "createdBy": "12"
}
```

Notes:

- Do not send backupPath from frontend.
- Backend uses backup_security_settings.storage_path.

Success 200 (encrypted example):

```json
{
  "status": true,
  "message": "Database backup completed successfully (encrypted - downloads as .encrypted file)",
  "data": {
    "backupPath": "D:/backups/nightly_backup_2026-08-12T10-00-00.encrypted",
    "size": 180120,
    "duration": 12,
    "encrypted": true,
    "keyId": "KEY-2026-001"
  }
}
```

Success 200 (not encrypted example):

```json
{
  "status": true,
  "message": "Database backup completed successfully",
  "data": {
    "backupPath": "D:/backups/nightly_backup_2026-08-12T10-00-00.sql",
    "size": 180120,
    "duration": 12,
    "encrypted": false,
    "keyId": null
  }
}
```

## 3) Backup Schedules

### POST /api/v1/security-features/backup/schedules

Request payload:

```json
{
  "schedule_name": "Daily DB Backup",
  "frequency": "daily",
  "backup_time": "23:30",
  "retention_days": 14,
  "employeeid": 12,
  "backup_path": "/mnt/backups",
  "backup_type": "database",
  "database_name": "primelab",
  "is_active": true
}
```

For files backup:

```json
{
  "schedule_name": "Daily Files Backup",
  "frequency": "daily",
  "backup_time": "23:30",
  "retention_days": 14,
  "employeeid": 12,
  "backup_path": "/mnt/backups",
  "backup_type": "files",
  "source_path": "/var/app/uploads",
  "is_active": true
}
```

Success 201:

```json
{
  "status": true,
  "message": "Backup schedule created successfully",
  "data": {
    "id": 5
  }
}
```

Validation notes from current backend validators:

- frequency must be one of: hourly, daily, weekly, monthly
- backup_time format must be HH:MM
- backup_path currently validates as path starting with /
- source_path required when backup_type is files

### GET /api/v1/security-features/backup/schedules

Query params:

- employeeid optional number
- is_active optional boolean string true|false
- backup_type optional database|files|full_system
- count optional number (default 50)
- page optional number (default 1)
- sortby optional ASC|DESC (default ASC)

Success 200:

```json
{
  "status": true,
  "data": [
    {
      "id": 5,
      "schedule_name": "Daily DB Backup",
      "frequency": "daily",
      "backup_time": "23:30:00",
      "retention_days": 14,
      "employeeid": 12,
      "backup_path": "/mnt/backups",
      "backup_type": "database",
      "is_active": true,
      "database_name": "primelab",
      "source_path": null,
      "last_run": "2026-08-12T23:30:04.000Z",
      "created_at": "2026-08-12T10:00:00.000Z",
      "updated_at": "2026-08-12T10:00:00.000Z",
      "username": "admin",
      "email": "admin@example.com"
    }
  ]
}
```

### GET /api/v1/security-features/backup/schedules/:id

Success 200:

```json
{
  "status": true,
  "data": {
    "id": 5,
    "schedule_name": "Daily DB Backup"
  }
}
```

Not found 404:

```json
{
  "status": false,
  "error": "Backup schedule not found"
}
```

### PUT /api/v1/security-features/backup/schedules/:id

Request payload: any subset of schedule fields.

Success 200:

```json
{
  "status": true,
  "message": "Backup schedule updated successfully"
}
```

### DELETE /api/v1/security-features/backup/schedules/:id

Success 200:

```json
{
  "status": true,
  "message": "Backup schedule deleted successfully"
}
```

### POST /api/v1/security-features/backup/schedules/:id/execute

Request body: none

Success 200:

```json
{
  "status": true,
  "message": "Scheduled backup executed successfully",
  "data": {
    "backupPath": "D:/backups/Daily DB Backup_2026-08-12T23-30-00.sql"
  }
}
```

### POST /api/v1/security-features/backup/schedules/run-all

Request body: none

Success 200:

```json
{
  "status": true,
  "message": "Scheduled backups processed",
  "data": {
    "processed": 3,
    "successful": 2,
    "failed": 1,
    "results": [
      { "scheduleId": 1, "success": true },
      { "scheduleId": 2, "success": false, "error": "source_path is required for files backup schedule" }
    ]
  }
}
```

## 4) Backup Logs, Stats, Delete, Download

### GET /api/v1/security-features/backup/logs

Each row includes `file_available`. It is true only for successful backups whose
recorded path currently points to a file. A historically successful backup can
have `file_available: false` after its file is moved or removed. Keep its history
but disable Download and show "File unavailable".

Query params:

- is_successful optional true|false
- backup_type optional database|files|full_system
- backup_mode optional automated|manual
- count optional number default 10
- page optional number default 1
- sortby optional ASC|DESC default DESC

Success 200:

```json
{
  "status": true,
  "data": [
    {
      "id": 10,
      "backup_name": "nightly_backup_2026-08-12T23-30-00",
      "is_successful": true,
      "backup_type": "database",
      "backup_mode": "automated",
      "backup_date": "2026-08-12T23:30:02.000Z",
      "backup_path": "D:/backups/nightly_backup_2026-08-12T23-30-00.encrypted",
      "encryption_key_id": "KEY-2026-001"
    }
  ]
}
```

### GET /api/v1/security-features/backup/logs/:id

Success 200:

```json
{
  "status": true,
  "data": {
    "id": 10,
    "backup_name": "nightly_backup_2026-08-12T23-30-00"
  }
}
```

### GET /api/v1/security-features/backup/stats

Success 200:

```json
{
  "status": true,
  "data": {
    "total_backups": 25,
    "successful_backups": 22,
    "failed_backups": 3,
    "total_size": 12500440,
    "last_backup_date": "2026-08-12T23:30:02.000Z"
  }
}
```

### DELETE /api/v1/security-features/backup/:id

Success 200:

```json
{
  "status": true,
  "message": "Backup deleted successfully"
}
```

### GET /api/v1/security-features/backup/logs/:id/download

Query param:

- decrypt=true optional for encrypted backups

Response:

- Binary stream, not JSON
- Header Content-Disposition contains filename
- Header X-Filename contains sanitized filename

Errors are JSON, not backup data:

- `404 BACKUP_NOT_FOUND`: the selected log no longer exists; refresh the logs.
- `404 BACKUP_FILE_NOT_FOUND`: the recorded file is unavailable. Restore the
  original file to its recorded server location or create a new backup.

Parse the error response and show its reason instead of a generic "404 Not Found".
Never save a JSON error or an HTML login page as a successful backup download.
Availability can change between listing and downloading; mark a row unavailable
when the download reports `BACKUP_FILE_NOT_FOUND`. Missing backup bytes are never
silently recreated or replaced by an empty file.

## 5) Encryption Keys and Decryption

### POST /api/v1/security-features/backup/generate-key

Request payload:

```json
{
  "createdBy": "12",
  "userKey": "StrongPass123!"
}
```

Success 201:

```json
{
  "status": true,
  "message": "Encryption key generated successfully",
  "data": {
    "keyId": "KEY-2026-002"
  }
}
```

### GET /api/v1/security-features/backup/encryption-keys

Success 200:

```json
{
  "status": true,
  "data": [
    {
      "key_id": "KEY-2026-002",
      "algorithm": "AES-256",
      "is_active": true,
      "created_at": "2026-08-12T12:00:00.000Z"
    }
  ]
}
```

### POST /api/v1/security-features/backup/rotate-key

Request payload:

```json
{
  "createdBy": "12",
  "force": true,
  "userKey": "StrongPass123!"
}
```

Success 200:

```json
{
  "status": true,
  "data": {
    "rotated": true,
    "newKeyId": "KEY-2026-003"
  }
}
```

### POST /api/v1/security-features/backup/:id/decrypt

Request payload:

```json
{
  "outputPath": "D:/backups/my_backup_decrypted.sql"
}
```

Success 200:

```json
{
  "status": true,
  "message": "Backup decrypted successfully",
  "data": {
    "outputPath": "D:/backups/my_backup_decrypted.sql",
    "keyId": "KEY-2026-001"
  }
}
```

## Frontend Implementation Notes

- Remove all backup policy UI and calls.
- Show encryption state from security settings based on encryption_password.
- Manual backup form should not ask for destination; backend uses storage_path.
- Treat download as file response, not JSON.

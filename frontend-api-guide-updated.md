# Frontend API Integration Guide - Complete Backup System

## 🔐 Authentication
All endpoints require: `?tenantId=<number>` as a query parameter.

---

## 📦 Backup Management

### Database Backup
POST /api/v1/security-features/backup/database?tenantId=1
Body (JSON):
```json
{
  "backupName": "daily_backup_2025",
  "backupPath": "/backups/database",
  "isFullBackup": true,
  "encryptBackup": true
}
```

### File Backup
POST /api/v1/security-features/backup/files?tenantId=1
Body (JSON):
```json
{
  "backupName": "files_backup_2025",
  "sourcePath": "/data/uploads",
  "backupPath": "/backups/files",
  "encryptBackup": true
}
```

### Get Backup Logs
GET /api/v1/security-features/backup/logs?tenantId=1
Optional query params: ?count=10&page=1&sortby=DESC

### Get Specific Backup
GET /api/v1/security-features/backup/logs/:id?tenantId=1

### Download Backup
GET /api/v1/security-features/backup/logs/:id/download?tenantId=1
Returns file stream.

### Get Backup Stats
GET /api/v1/security-features/backup/stats?tenantId=1

### Delete Backup (Auto Secure)
DELETE /api/v1/security-features/backup/:id?tenantId=1

**Behavior:** Checks tenant `secure_deletion_enabled` setting:
- If `true`: Performs secure multi-pass overwrite, then removes DB record
- If `false`: Regular file unlink + DB record removal

### Force Secure Delete
DELETE /api/v1/security-features/backup/:id/secure-delete?tenantId=1

**Behavior:** Always performs secure deletion regardless of settings.

---

## 🔒 Security & Encryption

### Get Security Settings
GET /api/v1/security-features/backup/security-settings?tenantId=1

**Response:**
```json
{
  "status": true,
  "data": {
    "id": 1,
    "encryption_enabled": true,
    "encryption_algorithm": "aes-256-cbc",
    "key_rotation_days": 90,
    "secure_deletion_enabled": true,
    "deletion_passes": 3,
    "current_key_id": "KEY-2025-001",
    "key_last_rotated": "2025-11-05T10:30:00.000Z",
    "is_active": true,
    "created_at": "2025-11-01T00:00:00.000Z",
    "updated_at": "2025-11-05T10:30:00.000Z"
  }
}
```

### Update Security Settings
PUT /api/v1/security-features/backup/security-settings?tenantId=1
Body (JSON):
```json
{
  "encryption_enabled": true,
  "encryption_algorithm": "aes-256-cbc",
  "key_rotation_days": 90,
  "secure_deletion_enabled": true,
  "deletion_passes": 3
}
```

**Response:**
```json
{
  "status": true,
  "message": "Security settings updated successfully"
}
```

### Generate Encryption Key
POST /api/v1/security-features/backup/generate-key?tenantId=1
Body (JSON):
```json
{
  "createdBy": "admin_user_id"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Encryption key generated successfully",
  "data": {
    "keyId": "KEY-2025-001"
  }
}
```

### Get All Encryption Keys
GET /api/v1/security-features/backup/encryption-keys?tenantId=1

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "id": 1,
      "key_id": "KEY-2025-001",
      "encrypted_key": "encrypted_hex_string",
      "algorithm": "aes-256-cbc",
      "created_at": "2025-11-05T10:30:00.000Z",
      "updated_at": "2025-11-05T10:30:00.000Z",
      "expires_at": "2026-02-03T10:30:00.000Z",
      "is_active": true,
      "deactivated_at": null,
      "created_by": "admin_user_id"
    }
  ]
}
```

### Rotate Encryption Key
POST /api/v1/security-features/backup/rotate-key?tenantId=1
Body (JSON):
```json
{
  "createdBy": "admin_user_id"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "rotated": true,
    "newKeyId": "KEY-2025-002"
  }
}
```

### Decrypt Backup
POST /api/v1/security-features/backup/:id/decrypt?tenantId=1
Body (JSON):
```json
{
  "outputPath": "/temp/decrypted_backup.sql"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Backup decrypted successfully",
  "data": {
    "outputPath": "/temp/decrypted_backup.sql"
  }
}
```

---

## 📊 Response Format (All endpoints)
JSON structure:
```json
{
  "status": true,          // boolean
  "data": { /* response data */ },
  "message": "Success message", // optional
  "error": "Error message" // only on failure
}
```

HTTP status codes: 200, 201, 400, 404, 500 as appropriate.

---

## ⚠️ Important Notes for Frontend
- Always include `?tenantId=<number>` on requests.
- Encryption keys are managed server-side; frontend should not handle raw keys.
- Secure deletion uses multiple overwrite passes when enabled.
- Key rotation happens automatically based on `key_rotation_days` setting.
- All keys are encrypted with a master key before storage.
- Decryption requires specifying the output path on server.

---

## 🎯 Complete Endpoint Summary
### Backup Management
POST   /api/v1/security-features/backup/database
POST   /api/v1/security-features/backup/files
GET    /api/v1/security-features/backup/logs
GET    /api/v1/security-features/backup/logs/:id
GET    /api/v1/security-features/backup/logs/:id/download
GET    /api/v1/security-features/backup/stats
DELETE /api/v1/security-features/backup/:id
DELETE /api/v1/security-features/backup/:id/secure-delete

### Security & Encryption
GET    /api/v1/security-features/backup/security-settings
PUT    /api/v1/security-features/backup/security-settings
POST   /api/v1/security-features/backup/generate-key
GET    /api/v1/security-features/backup/encryption-keys
POST   /api/v1/security-features/backup/rotate-key
POST   /api/v1/security-features/backup/:id/decrypt
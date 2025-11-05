# Frontend API Integration Guide - Security & Encryption Endpoints

## 🔐 Authentication
All endpoints require: `?tenantId=<number>` as a query parameter.

---

## � Security & Encryption Endpoints

### Get Security Settings
GET security-features/backup/security-settings?tenantId=1

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
PUT security-features/backup/security-settings?tenantId=1
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
POST security-features/backup/generate-key?tenantId=1
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
GET security-features/backup/encryption-keys?tenantId=1

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
      "expires_at": "2026-02-03T10:30:00.000Z",
      "is_active": true,
      "deactivated_at": null,
      "created_by": "admin_user_id"
    }
  ]
}
```

### Rotate Encryption Key
POST security-features/backup/rotate-key?tenantId=1
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
POST security-features/backup/:id/decrypt?tenantId=1
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

### Delete Backup (Auto Secure)
DELETE security-features/backup/:id?tenantId=1

**Behavior:** Automatically checks tenant security settings:
- If `secure_deletion_enabled: true`: Performs secure multi-pass overwrite, then removes DB record
- If `secure_deletion_enabled: false`: Regular file unlink + DB record removal

Uses the number of passes specified in `deletion_passes` setting (default: 3).

**Response:**
```json
{
  "status": true,
  "message": "Backup deleted successfully"
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

## 🎯 Endpoint Summary (Security Only)
GET    security-features/backup/security-settings
PUT    security-features/backup/security-settings
POST   security-features/backup/generate-key
GET    security-features/backup/encryption-keys
POST   security-features/backup/rotate-key
POST   security-features/backup/:id/decrypt
DELETE security-features/backup/:id
DELETE security-features/backup/:id/secure-delete
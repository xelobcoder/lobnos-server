# EncryptionManager Documentation

## Overview

The `EncryptionManager` class provides comprehensive encryption, decryption, and secure deletion functionality for backup files in a multi-tenant environment. It supports AES-256 encryption with automatic key rotation, secure file deletion with multiple overwrite passes, and integrates with database-backed security settings.

## Features

- **AES-256 Encryption**: Industry-standard encryption for backup files
- **Automatic Key Rotation**: Configurable key rotation based on time intervals
- **Secure Deletion**: Multiple-pass file overwriting before deletion
- **Multi-tenant Support**: Tenant-specific encryption keys and settings
- **Master Key Protection**: Encryption keys are protected with a master key
- **Database Integration**: All settings and keys stored in database tables

## Interfaces

### BackupSecuritySettings

Configuration interface for backup security settings.

```typescript
interface BackupSecuritySettings {
    id?: number;
    encryption_enabled: boolean;           // Whether encryption is enabled
    encryption_algorithm: string;          // Encryption algorithm (e.g., 'aes-256-cbc')
    encryption_password?: string | null;   // Password used to derive backup encryption key
    key_rotation_days: number;             // Days between key rotations
    secure_deletion_enabled: boolean;      // Whether secure deletion is enabled
    deletion_passes: number;               // Number of overwrite passes for secure deletion
    current_key_id?: string;               // ID of currently active encryption key
    key_last_rotated?: Date;               // Last key rotation timestamp
    is_active: boolean;                    // Whether these settings are active
    created_at?: Date;                     // Creation timestamp
    updated_at?: Date;                     // Last update timestamp
}
```

### EncryptionKey

Interface for encryption key records.

```typescript
interface EncryptionKey {
    id?: number;
    key_id: string;                        // Unique key identifier
    encrypted_key: string;                 // Master key encrypted key data
    algorithm: string;                     // Encryption algorithm used
    created_at: Date;                      // Key creation timestamp
    expires_at?: Date;                     // Key expiration date
    is_active: boolean;                    // Whether key is active
    deactivated_at?: Date;                 // Deactivation timestamp
    created_by?: string;                   // User who created the key
}
```

## Public Methods

### Security Settings Management

#### `getSecuritySettings(tenantId: number): Promise<BackupSecuritySettings | null>`

Retrieves the current active security settings for a tenant.

**Parameters:**
- `tenantId`: The tenant identifier

**Returns:** Active security settings or null if none exist

#### `updateSecuritySettings(tenantId: number, updates: Partial<BackupSecuritySettings>): Promise<boolean>`

Updates security settings for a tenant.

**Parameters:**
- `tenantId`: The tenant identifier
- `updates`: Partial settings object with fields to update

**Returns:** True if update was successful

#### `shouldEncryptBackups(tenantId: number): Promise<boolean>`

Checks whether backups should be encrypted for a tenant.

Behavior:
- Returns `true` only when `backup_security_settings.encryption_password` is present and non-empty.
- Returns `false` when password is not provided; backups are stored unencrypted.

### Key Management

#### `generateEncryptionKey(tenantId: number, createdBy?: string): Promise<string>`

Generates a new encryption key for a tenant.

**Parameters:**
- `tenantId`: The tenant identifier
- `createdBy`: Optional user identifier for audit purposes

**Returns:** The generated key ID

**Throws:** Error if no encryption password is configured

#### `getActiveEncryptionKey(tenantId: number): Promise<{ keyId: string; key: Buffer } | null>`

Retrieves the currently active encryption key for a tenant.

**Parameters:**
- `tenantId`: The tenant identifier

**Returns:** Object with keyId and decrypted key buffer, or null if no active key

#### `getAllEncryptionKeys(tenantId: number): Promise<EncryptionKey[]>`

Retrieves all encryption keys for a tenant (for audit purposes).

**Parameters:**
- `tenantId`: The tenant identifier

**Returns:** Array of all encryption keys ordered by creation date

#### `deactivateKey(tenantId: number, keyId: string): Promise<boolean>`

Deactivates an encryption key.

**Parameters:**
- `tenantId`: The tenant identifier
- `keyId`: The key identifier to deactivate

**Returns:** True if deactivation was successful

### File Operations

#### `encryptFile(tenantId: number, inputPath: string, outputPath: string): Promise<{ success: boolean; keyId?: string; error?: string }>`

Encrypts a file using the tenant's active encryption key.

**Parameters:**
- `tenantId`: The tenant identifier
- `inputPath`: Path to the file to encrypt
- `outputPath`: Path where encrypted file will be saved

**Returns:** Object with success status, optional keyId used, and optional error message

#### `decryptFile(tenantId: number, inputPath: string, outputPath: string, keyId: string): Promise<{ success: boolean; error?: string }>`

Decrypts a file using a specific encryption key.

**Parameters:**
- `tenantId`: The tenant identifier
- `inputPath`: Path to the encrypted file
- `outputPath`: Path where decrypted file will be saved
- `keyId`: The key ID used for encryption

**Returns:** Object with success status and optional error message

#### `secureDeleteFile(filePath: string, passes: number = 3): Promise<{ success: boolean; error?: string }>`

Securely deletes a file using multiple overwrite passes.

**Parameters:**
- `filePath`: Path to the file to delete
- `passes`: Number of overwrite passes (default: 3)

**Returns:** Object with success status and optional error message

### Key Rotation

#### `isKeyRotationNeeded(tenantId: number): Promise<boolean>`

Checks if key rotation is needed based on security settings.

**Parameters:**
- `tenantId`: The tenant identifier

**Returns:** True if rotation is needed

#### `rotateKeyIfNeeded(tenantId: number, createdBy?: string): Promise<{ rotated: boolean; newKeyId?: string; error?: string }>`

Rotates the encryption key if needed based on rotation schedule.

**Parameters:**
- `tenantId`: The tenant identifier
- `createdBy`: Optional user identifier for audit purposes

**Returns:** Object with rotation status, optional new key ID, and optional error message

## Private Methods

### `encryptWithMasterKey(data: Buffer): string`

Encrypts data using the master key.

**Parameters:**
- `data`: Buffer to encrypt

**Returns:** Hex-encoded encrypted data

### `decryptWithMasterKey(encryptedHex: string): Buffer`

Decrypts data using the master key.

**Parameters:**
- `encryptedHex`: Hex-encoded encrypted data

**Returns:** Decrypted buffer

### `getOverwritePattern(pass: number): number`

Gets the overwrite pattern for secure deletion passes.

**Parameters:**
- `pass`: Pass number

**Returns:** Pattern byte value

## Database Schema

### backup_security_settings Table

```sql
CREATE TABLE backup_security_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    encryption_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_algorithm VARCHAR(255) NOT NULL DEFAULT 'AES-256',
    encryption_password TEXT NULL,
    key_rotation_days INT NOT NULL DEFAULT 90,
    secure_deletion_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    deletion_passes INT NOT NULL DEFAULT 1,
    current_key_id VARCHAR(255),
    key_last_rotated DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### encryption_keys Table

```sql
CREATE TABLE encryption_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    key_id VARCHAR(100) NOT NULL UNIQUE,
    encrypted_key TEXT NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deactivated_at DATETIME,
    created_by VARCHAR(100),
    INDEX idx_key_id (key_id),
    INDEX idx_is_active (is_active),
    INDEX idx_created_at (created_at)
);
```

## Security Considerations

### Master Key
- The master key is stored in environment variable `BACKUP_MASTER_KEY`
- **CRITICAL**: Change the default master key in production
- Consider using secure key management services like AWS KMS or HashiCorp Vault

### Key Rotation
- Keys are rotated based on `key_rotation_days` setting
- Old keys remain available for decrypting existing backups
- Keys expire but are not automatically deleted for audit purposes

### Secure Deletion
- Uses multiple overwrite passes with different patterns
- Prevents data recovery from disk sectors
- Configurable number of passes via `deletion_passes` setting

### Encryption Details
- Uses AES-256-CBC with random IV per file
- IV is prepended to encrypted data
- Keys are 256-bit (32 bytes) generated using `crypto.randomBytes()`

## Usage Examples

### Basic Encryption Setup

```typescript
// Enable encryption for a tenant
await EncryptionManager.updateSecuritySettings(tenantId, {
    encryption_enabled: true,
    key_rotation_days: 90,
    secure_deletion_enabled: true,
    deletion_passes: 3
});

// Generate initial key
const keyId = await EncryptionManager.generateEncryptionKey(tenantId, 'admin');

// Encrypt a backup file
const result = await EncryptionManager.encryptFile(
    tenantId,
    '/path/to/backup.sql',
    '/path/to/backup.sql.encrypted'
);

if (result.success) {
    console.log('Backup encrypted with key:', result.keyId);
}
```

### File Decryption

```typescript
// Decrypt a backup file
const decryptResult = await EncryptionManager.decryptFile(
    tenantId,
    '/path/to/backup.sql.encrypted',
    '/path/to/backup.sql',
    'KEY-2025-001' 
);

if (decryptResult.success) {
    console.log('Backup decrypted successfully');
}
```

### Secure Deletion

```typescript
// Securely delete a file
const deleteResult = await EncryptionManager.secureDeleteFile(
    '/path/to/sensitive/file.txt',
    7 // 7 overwrite passes
);

if (deleteResult.success) {
    console.log('File securely deleted');
}
```

### Key Rotation

```typescript
// Check if rotation is needed
const needsRotation = await EncryptionManager.isKeyRotationNeeded(tenantId);

// Rotate if needed
const rotationResult = await EncryptionManager.rotateKeyIfNeeded(tenantId, 'system');

if (rotationResult.rotated) {
    console.log('New key generated:', rotationResult.newKeyId);
}
```

## Error Handling

All methods return structured error responses with `success` boolean and optional `error` message. Always check the `success` field before proceeding with the result.

```typescript
const result = await EncryptionManager.encryptFile(tenantId, inputPath, outputPath);
if (!result.success) {
    console.error('Encryption failed:', result.error);
    // Handle error appropriately
}
```

## Integration Points

The EncryptionManager integrates with:
- **BackupManager**: Automatic encryption during backup creation
- **BackupController**: API endpoints for encryption management
- **Database migrations**: Schema creation for security tables
- **Tenant system**: Multi-tenant key isolation

## Environment Variables

- `BACKUP_MASTER_KEY`: Master key for encrypting encryption keys (change from default in production)

## Dependencies

- `crypto`: Node.js built-in crypto module
- `fs`: Node.js built-in file system module
- `path`: Node.js built-in path module
- `KnexConnection`: Database connection utility
# Encryption rollout

## 1. HTTPS

Install a valid origin certificate and private key before activating the nginx configuration. Use Cloudflare Full (strict). The proxy must overwrite `X-Forwarded-Proto` with its actual connection scheme. Bind the backend to `127.0.0.1` when nginx runs on the same host.

```dotenv
HTTPS_REQUIRED=true
HTTPS_TRUSTED_PROXIES=loopback
HOST=127.0.0.1
```

For a remote proxy, use its exact IP or CIDR in `HTTPS_TRUSTED_PROXIES` and restrict the backend firewall to that proxy. A forwarded HTTP API request receives 426 before any application route runs. Existing authorization and tenant validation still run for accepted requests. Uploaded files are proxied through the application so its file-access checks apply.

For direct Node HTTPS, also set these values and provide a matching valid certificate.

```dotenv
HTTPS_ENABLED=true
SSL_CERT_PATH=/etc/pls/tls/fullchain.pem
SSL_KEY_PATH=/etc/pls/tls/private-key.pem
```

Set `HTTPS_REQUIRED=true` in the frontend environment too. Its shared server transport then rejects remote HTTP backend URLs. Supply `PRODUCTION_BASEURL` with an HTTPS origin. An explicitly enabled `HTTPS_ALLOW_LOOPBACK_HTTP=true` permits same-machine server calls over loopback. The desktop runtime retains its existing local HTTP path. Proxy traffic still requires HTTPS.

Verify the public site and API certificate chains, insecure API rejection, login, role switching, uploads and callbacks. Keep authenticated pages and APIs excluded from CDN caching.

## 2. Database TLS

Install a MySQL certificate with a subject alternative name matching each configured database hostname. Configure the server's `ssl_ca`, `ssl_cert` and `ssl_key`. The same policy covers MySQL pools, Knex, registry/control connections, provisioning and bootstrap connections.

```dotenv
DB_TLS_MODE=verify-full
DB_TLS_CA_FILE=/etc/pls/tls/mysql-ca.pem
# Optional mutual TLS identity, configured together
# DB_TLS_CERT_FILE=/etc/pls/tls/mysql-client.pem
# DB_TLS_KEY_FILE=/etc/pls/tls/mysql-client-key.pem
# Optional control-database CA override
# SYSTEM_CONFIG_DB_TLS_CA_FILE=/etc/pls/tls/control-ca.pem
```

The control connection inherits the DB TLS settings unless an explicit `SYSTEM_CONFIG_DB_TLS_*` override is supplied. Tenant registry rows continue choosing their existing host and database. They cannot turn verification off. Production remote database connections require verified TLS by default. Existing loopback connections retain their current behavior until TLS is activated.

Run a connection through both tenant clients and the control client. Confirm a non-empty `SHOW SESSION STATUS LIKE 'Ssl_cipher'` result. Check that a wrong CA or hostname fails. Once all server, migration, backup and administrative clients connect successfully, enable `require_secure_transport=ON` on MySQL and persist it through the database host configuration. This server setting affects other applications using that MySQL server, so verify their clients during rollout.

`PLS_ENCRYPTION_REQUIRED=true` enforces verified database TLS, HTTPS and encrypted backups together. Use the individual settings above during staged migration. Global certificate-verification bypasses are rejected.

## 3. Encrypted host storage

Protect the volumes containing MySQL data, uploads, generated reports, logs, backups and application/backup temporary files. On Windows, configure BitLocker through the host administrator and escrow the recovery key outside this application. On Linux, use an encrypted dm-crypt/LUKS volume or encrypted storage supplied by the hosting provider. Verify a restore before moving existing database files to new storage.

The application does not modify disk partitions or generate BitLocker recovery material. It can enforce host verification after volume encryption has completed.

```dotenv
STORAGE_ENCRYPTION_REQUIRED=true
STORAGE_ENCRYPTION_PATHS=["/var/lib/mysql","/srv/pls/uploads","/srv/pls/reports","/srv/pls/backups","/srv/pls/logs"]
UPLOAD_DIR=/srv/pls/uploads
BACKUP_TEMP_DIRECTORY=/srv/pls/private-tmp
```

Every listed directory and the upload/temp directories must exist. Startup fails if verification fails. Each backup also checks its actual destination and temporary directory. Windows requires BitLocker fully encrypted with protection on. Linux requires a visible dm-crypt ancestor. Cloud-provider encryption, network storage and hardware encryption require provider-side verification, which this host probe cannot establish. Keep that enforcement flag disabled on those platforms until an appropriate provider integration is available and retain the provider's encryption evidence.

```sh
npm run build
npm run security:storage-check -- /var/lib/mysql /srv/pls/uploads /srv/pls/backups /srv/pls/private-tmp
```

## 4. Backup keys and encrypted backups

Provision a high-entropy backup master secret of at least 32 characters in a secret manager or a service-readable file outside the application checkout, distribution and backed-up directories. Configure `BACKUP_MASTER_KEY_FILE` with the file's absolute path. The legacy `BACKUP_MASTER_KEY` setting remains supported for existing installations. Restrict the file and its parent directory to the service identity and authorized operators using Windows ACLs or Unix permissions. Escrow the secret separately from the database backups.

```dotenv
BACKUP_ENCRYPTION_REQUIRED=true
BACKUP_MASTER_KEY_FILE=/etc/pls/secrets/backup-master-key
BACKUP_TEMP_DIRECTORY=/srv/pls/private-tmp
```

Configure the existing tenant backup storage path and schedules through the current authorized settings pages. Production backups require encryption even when an individual caller omits the encryption option. Missing keys fail the operation. Development can retain its existing optional encryption behavior.

New backups stream directly into AES-256-GCM ciphertext. Metadata authenticates the tenant and key identifiers. Per-tenant random data keys are wrapped under the external master secret with authenticated encryption. New settings passwords are sealed on update and masked in API responses. Key records and settings remain in the same tenant database. A small MySQL client options file contains dump credentials during execution and is removed afterward. Keep the temporary directory on encrypted storage with service-only ACLs.

Manual backups and schedules use the same implementation. The legacy `backup.sh` now invokes the encrypted tenant-aware command instead of writing hardcoded databases to plaintext SQL files.

```sh
npm run backup:encrypted -- 123456
# Equivalent shell entry point
bash backup.sh 123456
```

The tenant must be registered, or match the configured standalone tenant. The configured tenant storage path is used and the existing backup log records the outcome.

## 5. Recovery and acceptance

- Restore a new encrypted backup and compare its content with the source. Complete a database restore into an isolated database before releasing the deployment.
- Restore an existing CBC backup using its original key record and original master secret. Existing backups remain readable. New authenticated-key records reject a legacy-format downgrade.
- Verify corrupted backups, wrong keys and cross-tenant attempts fail without publishing plaintext output.
- Reprint, report, prescription, billing, inventory and payroll permissions continue using their existing authorization paths.
- Preserve historical wrapped data-key records. Rotating a data key retains older keys for restores. Master-secret rotation requires rewrapping historical key records and sealed settings with both old and new secrets available. Changing the environment secret alone would make old data unreadable.
- Back up the tenant key records and settings along with the business database. Keep the master-secret recovery copy separately. Record and repeat an actual restore drill after key rotation.

The automated tests cover application behavior and cryptographic failure cases. Production certificates, Cloudflare configuration, database TLS negotiation, disk encryption and a live database restore require validation on the deployment host.

## References

- [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- [MySQL encrypted connections](https://dev.mysql.com/doc/refman/8.0/en/using-encrypted-connections.html)
- [mysql2 TLS configuration](https://sidorares.github.io/node-mysql2/docs/documentation/ssl)
- [OWASP cryptographic storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

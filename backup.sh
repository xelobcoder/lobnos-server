#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
# Uses the existing tenant backup settings and audit log. No plaintext SQL output.
exec node --env-file=.env ./dist/src/scripts/secure-backup.js "${1:-${BACKUP_TENANT_ID:-}}"

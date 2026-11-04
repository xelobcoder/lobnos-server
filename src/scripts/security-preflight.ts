import 'dotenv/config';
import path from 'node:path';
import { assertEncryptedPaths } from '../security/storageEncryption';

async function main() {
     const paths = process.argv.slice(2);
     if (paths.length === 0) throw new Error('Pass the database data, upload, backup and temporary directories as absolute paths');
     const checks = await assertEncryptedPaths(paths.map(value => path.resolve(value)));
     console.table(checks);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

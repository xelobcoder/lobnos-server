#!/usr/bin/env ts-node
/**
 * One-shot new client onboarding: provisions the database (schema clone + seeds),
 * runs the app's runtime bootstrappers so it's immediately usable, and optionally
 * generates an nginx config if domain/port/app-root are supplied.
 *
 * Usage (minimum, local/dev):
 *   npm run onboard:client -- --client ABC
 *
 * Usage (with nginx config for a real deployment):
 *   npm run onboard:client -- --client ABC --domain abc.labresults.example.com --port 2300 --app-root /opt/pls/abc
 */

import path from 'path';
import dotenv from 'dotenv';
import { execFileSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const REPO_ROOT = path.resolve(__dirname, '..');

interface Options {
     client: string;
     source: string;
     target: string;
     domain?: string;
     port?: string;
     appRoot?: string;
}

function parseArgs(argv: string[]): Options {
     const get = (flag: string) => {
          const idx = argv.indexOf(flag);
          return idx === -1 ? undefined : argv[idx + 1];
     };

     const client = get('--client');
     if (!client) {
          console.error('Usage: npm run onboard:client -- --client <name> [--source <dbName>] [--target <dbName>] [--domain <fqdn> --port <port> --app-root <path>]');
          process.exit(1);
     }

     const slug = client.toLowerCase().replace(/[^a-z0-9_]/g, '_');

     return {
          client,
          source: get('--source') || 'primelabmaster',
          target: get('--target') || `primetenant_${slug}`,
          domain: get('--domain'),
          port: get('--port'),
          appRoot: get('--app-root'),
     };
}

function step(title: string) {
     console.log(`\n=== ${title} ===`);
}

async function main() {
     const options = parseArgs(process.argv.slice(2));

     step(`1/3 Provisioning database "${options.target}" for "${options.client}"`);
     execFileSync(
          'node',
          [
               '--env-file=./.env',
               './node_modules/ts-node/dist/bin.js',
               './scripts/setup-new-client.ts',
               '--source', options.source,
               '--target', options.target,
               '--register-tenant',
               '--tenant-name', options.client,
          ],
          { stdio: 'inherit', cwd: REPO_ROOT }
     );

     step('2/3 Running runtime bootstrappers against the new database');
     process.env.DATABASE = options.target;
     const { runApplicationBootstrappers } = await import('../src/bootstrap/applicationStartup');
     const { accountingReady } = await runApplicationBootstrappers(1);
     console.log(`Bootstrappers completed (accountingReady=${accountingReady}).`);

     const KnexConnection = (await import('../src/database/KnexConnections')).default;
     const connection = await KnexConnection(1);
     const admin = await connection('roles').where({ username: 'admin' }).first();
     const panelCount = await connection('test_panels').count('* as c').first();
     console.log(`Verified: admin login present=${!!admin}, test_panels=${panelCount?.c}`);
     await connection.destroy();

     if (options.domain && options.port && options.appRoot) {
          step('3/3 Generating nginx config');
          execFileSync(
               'node',
               [
                    './node_modules/ts-node/dist/bin.js',
                    './scripts/generate-nginx-config.ts',
                    '--client', options.client,
                    '--domain', options.domain,
                    '--port', options.port,
                    '--app-root', options.appRoot,
               ],
               { stdio: 'inherit', cwd: REPO_ROOT }
          );
     } else {
          step('3/3 Skipped nginx config (pass --domain --port --app-root to generate one)');
     }

     step('Done');
     console.log(`Client "${options.client}" is provisioned on database "${options.target}".`);
     console.log(`Point that client's .env at DATABASE=${options.target}, set its own JWT_SECRET/SMTP, then start the app normally.`);
     console.log('Default seeded logins: super_admin/primelab, admin/admin — change these immediately.');
}

main().catch((error) => {
     console.error('Onboarding failed:', error);
     process.exit(1);
});

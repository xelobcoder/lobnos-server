#!/usr/bin/env ts-node
/**
 * Fills in nginx/client.conf.template for a specific client deployment.
 *
 * Usage:
 *   npm run nginx:new-client -- --client acme --domain acme.labresults.example.com --port 2300 --app-root /opt/pls/acme
 */

import path from 'path';
import fs from 'fs';

interface Options {
     client: string;
     domain: string;
     port: string;
     appRoot: string;
}

function parseArgs(argv: string[]): Options {
     const get = (flag: string) => {
          const idx = argv.indexOf(flag);
          return idx === -1 ? undefined : argv[idx + 1];
     };

     const client = get('--client');
     const domain = get('--domain');
     const port = get('--port');
     const appRoot = get('--app-root');

     if (!client || !domain || !port || !appRoot) {
          console.error('Usage: npm run nginx:new-client -- --client <name> --domain <fqdn> --port <upstreamPort> --app-root <absolutePath>');
          process.exit(1);
     }

     return { client, domain, port, appRoot };
}

const options = parseArgs(process.argv.slice(2));

const templatePath = path.resolve(__dirname, '..', 'nginx', 'client.conf.template');
const outPath = path.resolve(__dirname, '..', 'nginx', `${options.client}.conf`);

if (fs.existsSync(outPath)) {
     console.error(`Refusing to overwrite existing config: ${outPath}`);
     process.exit(1);
}

let config = fs.readFileSync(templatePath, 'utf8');
config = config.slice(config.indexOf('---- generated config below ----') + '---- generated config below ----'.length).replace(/^#?\s*\n/, '');
config = config
     .replace(/__CLIENT_NAME__/g, options.client.replace(/[^a-zA-Z0-9_]/g, '_'))
     .replace(/__CLIENT_DOMAIN__/g, options.domain)
     .replace(/__UPSTREAM_PORT__/g, options.port)
     .replace(/__APP_ROOT__/g, options.appRoot.replace(/\/$/, ''));

fs.writeFileSync(outPath, config, 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`Reminder: create ${options.appRoot}/logs/ so nginx can write nginx-${options.client}_access.log / _error.log.`);
console.log('Next steps: copy it to /etc/nginx/sites-available/, symlink into sites-enabled/, then `nginx -t && systemctl reload nginx`.');

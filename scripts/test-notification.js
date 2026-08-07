function parseArgs(argv) {
     const args = {};

     for (let i = 2; i < argv.length; i += 1) {
          const token = argv[i];
          if (!token.startsWith('--')) continue;

          const key = token.slice(2);
          const next = argv[i + 1];
          if (!next || next.startsWith('--')) {
               args[key] = 'true';
          } else {
               args[key] = next;
               i += 1;
          }
     }

     return args;
}

function normalizeNumber(value, fallback) {
     const parsed = Number(value);
     return Number.isFinite(parsed) ? parsed : fallback;
}

async function callJson(url, options = {}) {
     let response;
     try {
          response = await fetch(url, {
               ...options,
               headers: {
                    'content-type': 'application/json',
                    ...(options.headers || {}),
               },
          });
     } catch (error) {
          throw new Error(`Network error while calling ${url}. Ensure API is running and baseUrl is correct. ${error.message || error}`);
     }

     const bodyText = await response.text();
     let body;

     try {
          body = bodyText ? JSON.parse(bodyText) : null;
     } catch (_error) {
          body = bodyText;
     }

     if (!response.ok) {
          const message = typeof body === 'string' ? body : JSON.stringify(body);
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`);
     }

     return body;
}

function defaultBaseUrl() {
     const isDevelopment = process.env.NODE_ENV === 'development';
     const port = isDevelopment
          ? process.env.DEVELOPMENT_PORT
          : process.env.PRODUCTION_PORT;

     return `http://localhost:${port || 5000}`;
}

function defaultContext(eventCode) {
     return {
          event_code: eventCode,
          event_name: eventCode.replace(/_/g, ' '),
          triggered_at: new Date().toISOString(),
          patient_name: 'Notification Test Patient',
          patient_number: 'PLS-TEST-0001',
          patient_email: process.env.PROD_PLS_EMAIL_USER || 'test@example.com',
          patient_phone: '0240000000',
          laboratory_name: process.env.PROD_PLS_EMAIL_COMPANY || 'Prime Laboratory Services',
          laboratory_email: process.env.PROD_PLS_EMAIL_USER || 'support@example.com',
          laboratory_phone: '+233000000000',
          laboratory_website: 'https://example.com',
          branch_name: 'Main Branch',
          branch_email: process.env.PROD_PLS_EMAIL_USER || 'branch@example.com',
          branch_phone: '+233000000001',
          branch_address: '123 Main Street',
     };
}

async function main() {
     const args = parseArgs(process.argv);

     if (args.help === 'true') {
          console.log('Usage:');
          console.log('  pnpm run notification:test -- --to recipient@example.com --eventCode PATIENT_CREATED');
          console.log('');
          console.log('Options:');
          console.log('  --baseUrl       API base URL (default: http://localhost:5000)');
          console.log('  --tenantId      Tenant id query value (default: 1)');
          console.log('  --eventCode     Event code to trigger (default: PATIENT_CREATED)');
          console.log('  --to            Recipient email (default: PROD_PLS_EMAIL_USER)');
          console.log('  --priority      low|normal|high (default: normal)');
          console.log('  --createdBy     Created by user id (default: 1)');
          console.log('  --skipSync      Skip definitions sync step');
          return;
     }

     const baseUrl = (args.baseUrl || defaultBaseUrl()).replace(/\/+$/, '');
     const tenantId = normalizeNumber(args.tenantId, 1);
     const eventCode = args.eventCode || 'PATIENT_CREATED';
     const to = args.to || process.env.PROD_PLS_EMAIL_USER;
     const priority = args.priority || 'normal';
     const createdBy = normalizeNumber(args.createdBy, 1);

     if (!to) {
          throw new Error('Provide --to or set PROD_PLS_EMAIL_USER in .env');
     }

     const tenantQuery = `tenantId=${encodeURIComponent(String(tenantId))}`;
     const syncUrl = `${baseUrl}/api/v1/notifications/events/sync-definitions?${tenantQuery}`;
     const catalogUrl = `${baseUrl}/api/v1/notifications/events/${encodeURIComponent(eventCode)}/catalog?${tenantQuery}`;
     const triggerUrl = `${baseUrl}/api/v1/notifications/trigger?${tenantQuery}`;

     if (args.skipSync !== 'true') {
          const syncResult = await callJson(syncUrl, { method: 'POST', body: '{}' });
          console.log('Definitions sync completed');
          console.log(`Events processed: ${Array.isArray(syncResult?.result) ? syncResult.result.length : 0}`);
     }

     const catalog = await callJson(catalogUrl);
     const hasPersistedDefault = Boolean(catalog?.result?.template?.id);

     if (!hasPersistedDefault) {
          console.warn(`Default template for ${eventCode} is not persisted in DB yet.`);
     } else {
          console.log(`Default template for ${eventCode} is persisted in DB.`);
     }

     const payload = {
          eventCode,
          priority,
          createdBy,
          recipients: {
               to: [to],
               cc: [],
               bcc: [],
          },
          context: defaultContext(eventCode),
     };

     const triggerResult = await callJson(triggerUrl, {
          method: 'POST',
          body: JSON.stringify(payload),
     });

     console.log('Notification trigger response:');
     console.log(JSON.stringify(triggerResult, null, 2));
}

main().catch((error) => {
     console.error('Notification test failed');
     console.error(error.message || error);
     process.exit(1);
});

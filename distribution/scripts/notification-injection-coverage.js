const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const codes = new Set();
const dynamic = [];

function walk(d) {
     for (const f of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, f.name);
          if (f.isDirectory()) {
               walk(p);
               continue;
          }
          if (!/\.(ts|js)$/.test(f.name)) continue;
          if (p.includes('node_modules')) continue;
          if (p.includes('NotificationEventCatalog')) continue;
          if (p.includes('NotificationBootstrap')) continue;
          if (p.includes('migrations')) continue;

          const t = fs.readFileSync(p, 'utf8');
          const re = /NotificationDispatcher\.dispatch(?:ByContext)?\([^,]+,\s*['"]([A-Z0-9_]+)['"]/g;
          let m;
          while ((m = re.exec(t))) codes.add(m[1]);

          if (/NotificationDispatcher\.dispatch(?:ByContext)?\([^,]+,\s*[a-zA-Z_]/.test(t)) {
               dynamic.push(path.relative(path.join(__dirname, '..'), p));
          }
     }
}

walk(root);

const catalogMod = require('../dist/src/models/application/notifications/context/providers/NotificationEventCatalog.js');
const catalog = (catalogMod.NOTIFICATION_EVENT_CATALOG || []).map((x) => x.eventCode);
const inj = [...codes].sort();

const dynamicKnown = new Set([
     'SAMPLE_COLLECTED',
     'SAMPLE_RECEIVED',
     'SAMPLE_ACCEPTED',
     'SAMPLE_REJECTED',
     'SAMPLE_RECALL_REQUIRED',
     'SAMPLE_RECOLLECTED',
     'SAMPLE_PROCESSED',
     'SUPPLIER_PAYMENT_PROCESSED',
     'SUPPLIER_PAYMENT_PENDING',
     'SUPPLIER_PAYMENT_FAILED',
     'APPOINTMENT_CONFIRMED',
     'APPOINTMENT_CANCELLED',
     'APPOINTMENT_MISSED',
     'APPOINTMENT_RESCHEDULED',
     'PURCHASE_ORDER_CANCELLED',
     'PURCHASE_ORDER_RECEIVED',
     'PURCHASE_ORDER_PARTIALLY_RECEIVED',
     'PURCHASE_ORDER_SUBMITTED',
     'PURCHASE_ORDER_APPROVED',
     'PURCHASE_ORDER_REJECTED',
     'PURCHASE_ORDER_SENT_TO_SUPPLIER',
     'PURCHASE_ORDER_ACKNOWLEDGED',
     'PURCHASE_ORDER_CLOSED',
     'SUPPLIER_ACTIVATED',
     'SUPPLIER_DEACTIVATED',
     'REFUND_APPROVED',
     'REFUND_REJECTED',
     'STOCK_RECEIVED',
     'STOCK_RETURNED',
     'STOCK_ISSUED',
     'STOCK_ADJUSTED',
     'STOCK_TRANSFER_COMPLETED',
     'STOCK_RECEIPT_COMPLETED',
     'PAYMENT_PENDING',
     'PAYMENT_RECEIVED',
     'PAYMENT_FAILED',
     'PAYMENT_REVERSED',
     'PAYMENT_CONFIRMED',
]);

const effectivelyCovered = new Set([...codes, ...dynamicKnown]);
const stillMissing = catalog.filter((c) => !effectivelyCovered.has(c));

console.log('LITERAL_INJECTED', inj.length);
console.log(inj.join('\n'));
console.log('---DYNAMIC_FILES');
console.log([...new Set(dynamic)].join('\n'));
console.log('---EFFECTIVE_COVERED', effectivelyCovered.size);
console.log('---STILL_MISSING', stillMissing.length);
console.log(stillMissing.join('\n'));

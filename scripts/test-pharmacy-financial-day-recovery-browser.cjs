const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const frontend = path.resolve(__dirname, '..', '..', 'lobnos');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pls-day-recovery-'));
const write = (name, value) => fs.writeFileSync(path.join(temporary, name), value);
const frontendModule = name => require(path.join(frontend, 'node_modules', name));

write('ts-loader.cjs', `
const ts = require(${JSON.stringify(path.join(frontend, 'node_modules', 'typescript'))});
module.exports = function(source) {
  return ts.transpileModule(source, { fileName: this.resourcePath, compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, allowJs: true
  }}).outputText;
};`);
write('css-loader.cjs', `
module.exports = function(source) {
  const prefix = 'p_' + require('crypto').createHash('sha1').update(this.resourcePath).digest('hex').slice(0, 8) + '_';
  const names = {}, globals = [];
  source = source.replace(/:global\\(([^)]+)\\)/g, (_, value) => { globals.push(value); return 'GLOBALTOKEN' + (globals.length - 1); });
  source = source.replace(/\\.([a-zA-Z_][\\w-]*)/g, (_, name) => { names[name] = prefix + name; return '.' + prefix + name; });
  source = source.replace(/GLOBALTOKEN(\\d+)/g, (_, index) => globals[Number(index)]);
  return 'const el=document.createElement("style");el.textContent=' + JSON.stringify(source) + ';document.head.appendChild(el);export default ' + JSON.stringify(names) + ';';
};`);
write('context.ts', `
export const useApplication = () => ({
  user: { employeeid: Number(new URLSearchParams(location.search).get('employee') || 1),
    role: new URLSearchParams(location.search).get('role') || 'admin', branch: 2, tenantId: 1 }
});`);
write('next.tsx', `import React from 'react'; export default function Link({href,children,...props}) { return <a href={href} {...props}>{children}</a>; }`);
write('fetch.ts', `
export const currencyFormatter = new Intl.NumberFormat('en-GH', {style:'currency', currency:'GHS'});
const state = () => window.__fixture;
const failure = message => ({success:false,error:{message}});
const copy = value => structuredClone(value);
export async function customFetch(url) {
  const f = state();
  if (url === 'pharmacy/checkout-setup') {
    const previous = f.days.filter(day => day.status === 'open' && day.financial_date < '2026-11-03').sort((a,b) => a.financial_date.localeCompare(b.financial_date))[0];
    return {success:true,data:copy({financialDate:'2026-11-03',day:f.today,previousDay:previous||null,previousShift:null,accounts:[],routes:[]})};
  }
  if (url === 'pharmacy/management/reports') return {success:true,data:copy({days:f.days,shifts:f.shifts,balances:[],documents:[],events:[],revenue:0,costOfSales:0,expenses:0,profit:0})};
  if (url === 'pharmacy/suppliers') return {success:true,data:[]};
  if (url === 'pharmacy/accounting/settings') return {success:true,data:{enabled:false,mappings:{}}};
  const match = url.match(/^pharmacy\\/management\\/shifts\\/([^/]+)\\/handover$/);
  if (match) {
    if (f.failSummary) { f.failSummary = false; return failure('Cash breakdown unavailable'); }
    const shift = f.shifts.find(row => row.id === decodeURIComponent(match[1]));
    if (!shift) return failure('Shift not found');
    return {success:true,data:copy({shiftId:shift.id,cashierId:shift.cashier_id,financialDate:shift.financial_date,
      openingFloat:shift.opening_float,cashSales:0,cashRefunds:0,cashOut:0,expectedCash:shift.expected_cash ?? 20,
      closed:!!shift.closed_at,reviewed:!!shift.reviewed_by,countedCash:shift.counted_cash ?? null,variance:shift.variance ?? null})};
  }
  return failure('Unexpected synthetic read: ' + url);
}
export async function customFetchMutation(url, method, body) {
  const f = state();
  f.writes.push({url,method,body:copy(body)});
  if (f.failNext) { f.failNext = false; return failure('Shift changed. Reload and review.'); }
  const match = url.match(/^pharmacy\\/management\\/shifts\\/([^/]+)\\/(close|review)$/);
  if (match) {
    const shift = f.shifts.find(row => row.id === decodeURIComponent(match[1]));
    const day = shift && f.days.find(row => row.financial_date === shift.financial_date);
    if (!shift || day?.status !== 'open') return failure('This pharmacy financial day is closed');
    if (match[2] === 'close') {
      if (shift.closed_at || typeof body.countedCash !== 'number' || body.countedCash < 0) return failure('Invalid cash count');
      Object.assign(shift,{closed_at:'2026-11-03T10:00:00Z',counted_cash:body.countedCash,expected_cash:20,variance:body.countedCash-20});
    } else {
      if (!shift.closed_at || shift.reviewed_by || !body.note) return failure('A closed handover and review note are required');
      const params = new URLSearchParams(location.search), actor = Number(params.get('employee') || 1);
      const role = (params.get('role') || 'admin').toLowerCase().replace(/[\\s_-]/g, '');
      if (shift.cashier_id === actor && (!['admin','superadmin'].includes(role) || body.adminSelfReview !== true || body.note.trim().length < 10)) return failure('An authorized administrator acknowledgement and reason are required');
      shift.reviewed_by = actor;
    }
    return {success:true,data:{}};
  }
  if (url === 'pharmacy/management/reopen-day') {
    const day = f.days.find(row => row.financial_date === body.date);
    if (!day || day.status !== 'closed' || String(body.reason || '').length < 10 || body.expectedClosedAt !== day.closed_at) return failure('Cannot reopen this day');
    Object.assign(day,{status:'open',closed_at:null,explicitly_reopened:!day.opened_at});
    return {success:true,data:{reopened:true}};
  }
  if (url === 'pharmacy/management/close-day') {
    const day = f.days.find(row => row.financial_date === body.date);
    if (!day || day.status !== 'open' || f.shifts.some(shift => shift.financial_date <= body.date && (!shift.closed_at || !shift.reviewed_by))) return failure('Finish all cash handovers first');
    Object.assign(day,{status:'closed',closed_at:'2026-11-03T10:00:00Z'});
    return {success:true,data:{closed:true}};
  }
  if (url === 'pharmacy/management/open-day') {
    if (body.date !== '2026-11-03' || f.days.some(day => day.status === 'open' && day.financial_date < body.date)) return failure('Close the previous day first');
    f.today = {id:'today',financial_date:body.date,status:'open',opened_at:'2026-11-03T10:00:00Z'};
    return {success:true,data:{status:'open'}};
  }
  return failure('Unexpected synthetic mutation: ' + url);
}`);
write('entry.tsx', `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Page from ${JSON.stringify(path.join(frontend, 'app', 'pharmacy', 'finance', 'page'))};
const historical = new URLSearchParams(location.search).get('scenario') === 'historical';
const date = historical ? '2026-11-01' : '2026-11-02';
window.__fixture = {
  days:[{id:'previous',financial_date:'2026-11-02',status:'open',opened_at:'2026-11-02T00:56:44Z'},
    ...(historical ? [{id:'older',financial_date:'2026-11-01',status:'closed',opened_at:null,closed_at:'2026-11-01T22:00:00Z'}] : [])],
  shifts:[{id:'open-shift',cashier_id:2,financial_date:date,opened_at:date+'T08:00:00Z',opening_float:20},
    {id:'closed-shift',cashier_id:3,financial_date:date,opened_at:date+'T09:00:00Z',opening_float:20,closed_at:date+'T18:00:00Z',expected_cash:20,counted_cash:15,variance:-5}],
  today:null,writes:[],failNext:false,failSummary:false
};
createRoot(document.getElementById('root')).render(<Page/>);`);

const server = http.createServer((request, response) => {
     if (request.url === '/app.js') {
          response.setHeader('Content-Type', 'text/javascript');
          return response.end(fs.readFileSync(path.join(temporary, 'app.js')));
     }
     if (request.url === '/bootstrap.css') {
          response.setHeader('Content-Type', 'text/css');
          return response.end(fs.readFileSync(path.join(frontend, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.min.css')));
     }
     response.setHeader('Content-Type', 'text/html');
     response.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bootstrap.css"><div id="root"></div><script src="/app.js"></script>');
});

async function buildFixture() {
     const { webpack } = frontendModule('next/dist/compiled/webpack/webpack');
     await new Promise((resolve, reject) => webpack({
          mode: 'development', devtool: false, entry: path.join(temporary, 'entry.tsx'),
          output: { path: temporary, filename: 'app.js' },
          resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], modules: [path.join(frontend, 'node_modules')] },
          module: { rules: [
               { test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(temporary, 'ts-loader.cjs') },
               { test: /\.css$/, use: path.join(temporary, 'css-loader.cjs') },
          ] },
          plugins: [
               new webpack.NormalModuleReplacementPlugin(/customFetch$/, resource => { resource.request = path.join(temporary, 'fetch.ts'); }),
               new webpack.NormalModuleReplacementPlugin(/useApplicationContext$/, resource => { resource.request = path.join(temporary, 'context.ts'); }),
               new webpack.NormalModuleReplacementPlugin(/^next\/link$/, resource => { resource.request = path.join(temporary, 'next.tsx'); }),
          ],
     }, (error, stats) => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
}

async function review(page, staff) {
     await page.getByRole('row').filter({ hasText: `Staff #${staff}` }).getByRole('button', { name: 'Review handover', exact: true }).click();
     const task = page.locator('section[aria-label="Review cashier handover"]');
     await task.getByLabel('Review note').fill('Verified the cash count and recorded difference');
     await task.getByRole('button', { name: 'Confirm handover review' }).click();
     await task.waitFor({ state: 'detached' });
}

async function closeShift(page, count, exerciseFailures = false) {
     if (exerciseFailures) await page.evaluate(() => { window.__fixture.failSummary = true; });
     await page.getByRole('button', { name: 'Close with cash count', exact: true }).click();
     const task = page.locator('section[aria-label="Close cashier shift"]');
     if (exerciseFailures) {
          await task.getByRole('alert').filter({ hasText: 'Cash breakdown unavailable' }).waitFor();
          await task.getByRole('button', { name: 'Reload shift breakdown' }).click();
     }
     await task.getByLabel('Cash counted (GHS)').fill(String(count));
     if (exerciseFailures) {
          await page.evaluate(() => { window.__fixture.failNext = true; });
          await task.getByRole('button', { name: 'Close shift & record variance' }).click();
          await task.getByRole('alert').filter({ hasText: 'Shift changed. Reload and review.' }).waitFor();
          assert.equal(await task.getByLabel('Cash counted (GHS)').inputValue(), String(count));
     }
     await task.getByRole('button', { name: 'Close shift & record variance' }).click();
     await task.waitFor({ state: 'detached' });
}

async function main() {
     let browser;
     try {
          await buildFixture();
          await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
          const localPlaywright = path.join(frontend, 'node_modules', 'playwright');
          const cachedPlaywright = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright');
          const playwrightPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync(localPlaywright) ? localPlaywright : cachedPlaywright);
          const { chromium } = require(playwrightPath);
          const edge = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
          browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
          const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('dialog', dialog => dialog.accept());
          await page.clock.install({ time: new Date('2026-11-03T12:00:00Z') });
          const base = `http://127.0.0.1:${server.address().port}`;

          await page.goto(base);
          await page.getByRole('button', { name: 'Review previous day & shifts' }).click();
          await page.getByText('1 remaining', { exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Close previous financial day' }).isDisabled(), true);
          for (const width of [320, 390, 768, 1440]) {
               await page.setViewportSize({ width, height: 844 });
               const geometry = await page.getByRole('button', { name: 'Close with cash count' }).evaluate(element => {
                    const region = element.closest('[role="region"]'), view = region.getBoundingClientRect(), button = element.getBoundingClientRect();
                    const staff = Array.from(element.closest('tr').cells).find(cell => cell.textContent.trim() === 'Staff #2').getBoundingClientRect();
                    return { scrollLeft: region.scrollLeft, left: button.left, right: button.right, staffLeft: staff.left, staffRight: staff.right, viewLeft: view.left, viewRight: view.right, viewport: innerWidth };
               });
               assert.equal(geometry.scrollLeft, 0);
               assert.ok(geometry.left >= geometry.viewLeft && geometry.right <= Math.min(geometry.viewRight, geometry.viewport), `Shift action must be visible at ${width}px: ${JSON.stringify(geometry)}`);
               assert.ok(geometry.staffLeft >= geometry.viewLeft && geometry.staffRight <= Math.min(geometry.viewRight, geometry.viewport), `Shift staff must be visible at ${width}px: ${JSON.stringify(geometry)}`);
          }
          await page.setViewportSize({ width: 390, height: 844 });
          console.log('PASS Both blockers, their staff, and the shift action are visible without horizontal scrolling');

          await review(page, 3);
          assert.equal(await page.getByRole('button', { name: 'Close previous financial day' }).isDisabled(), true);
          await closeShift(page, 18, true);
          assert.equal(await page.getByRole('button', { name: 'Close previous financial day' }).isDisabled(), true);
          await review(page, 2);
          await page.getByRole('button', { name: 'Close previous financial day' }).click();
          await page.getByRole('button', { name: 'Open financial day' }).click();
          await page.getByText('Financial day opened. Cashiers can now open their shifts.').waitFor();
          const writes = await page.evaluate(() => window.__fixture.writes);
          assert.equal(writes.find(write => write.url.endsWith('/open-shift/close')).body.countedCash, 18);
          assert.equal(writes.find(write => write.url.endsWith('close-day')).body.date, '2026-11-02');
          assert.equal(writes.find(write => write.url.endsWith('open-day')).body.date, '2026-11-03');
          console.log('PASS Failed cash breakdowns and submissions recover without losing the count');
          console.log('PASS Both handovers require counts/reviews before 2 November closes and 3 November opens');

          await page.goto(`${base}/?role=pharmacyaccountant&employee=2#days`);
          await page.getByRole('heading', { name: 'Finish 2 Nov 2026' }).waitFor();
          assert.equal(await page.getByRole('link', { name: 'Close your shift' }).getAttribute('href'), '/pharmacy/cashier');
          assert.equal(await page.getByRole('button', { name: 'Review handover', exact: true }).count(), 0);
          await page.getByText('Ask a pharmacy manager or administrator to review this handover.').waitFor();
          console.log('PASS Accountant can find their own shift without gaining manager review permission');

          await page.goto(`${base}/?role=pharmacy_manager&employee=3#days`);
          const ownManagerRow = page.getByRole('row').filter({ hasText: 'Staff #3' });
          await ownManagerRow.getByText("Awaiting another manager's review.", { exact: false }).waitFor();
          assert.equal(await ownManagerRow.getByRole('button', { name: 'Review handover', exact: true }).count(), 0);
          await page.goto(`${base}/?role=admin&employee=3#days`);
          await page.getByRole('button', { name: 'Admin review handover' }).click();
          const adminReview = page.locator('section[aria-label="Review cashier handover"]');
          await adminReview.getByLabel('Administrator review reason').fill('Verified the cash and recorded difference');
          assert.equal(await adminReview.getByRole('button', { name: 'Confirm handover review' }).isDisabled(), true);
          await adminReview.getByRole('checkbox').check();
          await adminReview.getByRole('button', { name: 'Confirm handover review' }).click();
          await adminReview.waitFor({ state: 'detached' });
          const selfReview = await page.evaluate(() => window.__fixture.writes.find(write => write.url.endsWith('/closed-shift/review')));
          assert.equal(selfReview.body.adminSelfReview, true);
          assert.equal(selfReview.body.note, 'Verified the cash and recorded difference');
          assert.equal(await page.getByRole('button', { name: 'Close previous financial day' }).isDisabled(), true);
          console.log('PASS Manager self-review stays blocked; administrator self-review requires explicit acknowledgement');

          await page.goto(`${base}/?scenario=historical#days`);
          await page.getByRole('heading', { name: 'Finish 2 Nov 2026' }).waitFor();
          await page.getByRole('button', { name: 'Reopen shift day' }).first().click();
          const reopen = page.locator('section[aria-label="Reopen pharmacy financial day"]');
          assert.equal(await reopen.getByLabel('Closed date').inputValue(), '2026-11-01');
          await reopen.getByLabel('Reason for reopening').fill('Resolve the historical cashier handovers');
          await reopen.getByRole('checkbox').check();
          await reopen.getByRole('button', { name: 'Reopen financial day' }).click();
          await page.getByRole('heading', { name: 'Finish 1 Nov 2026' }).waitFor();
          const reopened = await page.evaluate(() => window.__fixture);
          assert.equal(reopened.shifts[1].counted_cash, 15);
          assert.equal(reopened.shifts[1].variance, -5);
          assert.equal(reopened.writes[0].body.expectedClosedAt, '2026-11-01T22:00:00Z');
          await closeShift(page, 22);
          await review(page, 2);
          await review(page, 3);
          await page.getByRole('button', { name: 'Close previous financial day' }).click();
          await page.getByRole('heading', { name: 'Finish 2 Nov 2026' }).waitFor();
          assert.deepEqual(errors, []);
          console.log('PASS Reopened legacy day keeps recorded cash evidence and can be resolved and closed');
     } finally {
          if (browser) await browser.close();
          if (server.listening) await new Promise(resolve => server.close(resolve));
          fs.rmSync(temporary, { recursive: true, force: true });
     }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

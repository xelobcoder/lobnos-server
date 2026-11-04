const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const frontend = path.resolve(__dirname, '..', '..', 'lobnos');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pls-financial-reports-'));
const write = (name, value) => fs.writeFileSync(path.join(temporary, name), value);
const frontendModule = name => require(path.join(frontend, 'node_modules', name));
write('ts-loader.cjs', `
const ts = require(${JSON.stringify(path.join(frontend, 'node_modules', 'typescript'))});
module.exports = function(source) { return ts.transpileModule(source, { fileName: this.resourcePath,
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, allowJs: true } }).outputText; };`);
write('css-loader.cjs', `
module.exports = function(source) {
  const prefix = 'p_' + require('crypto').createHash('sha1').update(this.resourcePath).digest('hex').slice(0, 8) + '_';
  const names = {}, globals = [];
  source = source.replace(/:global\\(([^)]+)\\)/g, (_, value) => { globals.push(value); return 'GLOBALTOKEN' + (globals.length - 1); });
  source = source.replace(/\\.([a-zA-Z_][\\w-]*)/g, (_, name) => { names[name] = prefix + name; return '.' + prefix + name; });
  source = source.replace(/GLOBALTOKEN(\\d+)/g, (_, index) => globals[Number(index)]);
  return 'const el=document.createElement("style");el.textContent=' + JSON.stringify(source) + ';document.head.appendChild(el);export default ' + JSON.stringify(names) + ';';
};`);
write('navigation.ts', `
import { useSyncExternalStore } from 'react';
export const useSearchParams = () => new URLSearchParams(useSyncExternalStore(
  callback => { addEventListener('popstate', callback); return () => removeEventListener('popstate', callback); },
  () => location.search
));`);
write('link.tsx', `
import React from 'react';
export default function Link({ href, children, ...props }) {
  return <a href={href} {...props} onClick={event => {
    event.preventDefault(); history.pushState({}, '', href); dispatchEvent(new PopStateEvent('popstate'));
  }}>{children}</a>;
}`);
write('fetch.ts', `export const currencyFormatter = new Intl.NumberFormat('en-GH', {style:'currency',currency:'GHS'});`);
write('api.ts', `
export function useResource(endpoint) {
  window.__requests.push(endpoint);
  const report = new URLSearchParams(endpoint.split('?')[1]).get('report');
  const filters = new URLSearchParams(endpoint.split('?')[1]);
  const ledger = [
    {id:1,journal_id:'266a7e7d-5e3b-4d61-9a7a-f4a82ade9174',date:'2026-10-24',account:'collection:1',account_number:'1000',account_name:'Synthetic cash',normal_balance:'debit',description:'Synthetic pharmacy sale',source_document:'f262eb76-53c6-40b5-911b-f8043b7174ef',kind:'sale',debit:100,credit:0,running_balance:100,journal_debit:100,journal_credit:100,journal_line_count:2,journal_line_number:1},
    {id:2,journal_id:'266a7e7d-5e3b-4d61-9a7a-f4a82ade9174',date:'2026-10-24',account:'sales',account_number:'4000',account_name:'Synthetic sales',normal_balance:'credit',description:'Synthetic pharmacy sale',source_document:'f262eb76-53c6-40b5-911b-f8043b7174ef',kind:'sale',debit:0,credit:100,running_balance:100,journal_debit:100,journal_credit:100,journal_line_count:2,journal_line_number:2}
  ];
  const data = endpoint.startsWith('ledger?') ? {
    rows:filters.get('account') ? ledger.filter(row=>row.account===filters.get('account')) : ledger,
    total:filters.get('account') ? 1 : 2,journalCount:1,
    periodTotals:{debit:100,credit:filters.get('account') ? 0 : 100},
    openingBalance:0,closingBalance:100,normalBalance:'debit',
    accountBalances:[{account:'collection:1',account_number:'1000',account_name:'Synthetic cash',normal_balance:'debit',opening:0,closing:100}]
  } : report === 'balance_sheet' ? {
    rows: [
      {section:'Assets',account_number:'1000',account_name:'Synthetic cash',amount:1500},
      {section:'Assets',account_number:'1010',account_name:'Synthetic bank',amount:-100},
      {section:'Liabilities',account_number:'2000',account_name:'Synthetic payable',amount:400},
      {section:'Equity',account_number:'3100',account_name:'Synthetic equity',amount:1000}
    ],
    columns:[{key:'section',label:'Section'},{key:'account_number',label:'Account no.'},{key:'account_name',label:'Account'},{key:'amount',label:'Amount (GHS)'}],
    totals:{assets:1400,liabilities:400,equity:1000,unclassified:0,balanceDifference:0},
    summary:{bookRevenue:100,costOfSales:20,operatingExpenses:10,profit:70}
  } : report === 'cash_flow' ? {
    rows:[{id:'review-journal',section:'Classification required',description:'Offsetting cash journal',inflow:100,outflow:100,net:0}],
    columns:['section','description','inflow','outflow','net'],
    classificationIssues:window.__reviewed?[]:[{journalId:'review-journal',description:'Offsetting cash journal',amount:0}],
    totals:{netMovement:0}
  } : {
    rows:[{section:'Revenue',account:'sales',account_name:'Synthetic report evidence',amount:'12.00'}],
    columns:['section','account_name','amount'],totals:{netProfit:12}
  };
  return { data: window.__fail ? null : data, loading:false, error:window.__fail ? 'Synthetic report unavailable' : '', refresh(){dispatchEvent(new PopStateEvent('popstate'));} };
}
export async function request(endpoint,method,body) {
  if(endpoint==='cash-flow/review-journal/classification'&&method==='PUT'){
    window.__reviews.push({endpoint,method,body});window.__reviewed=true;return {};
  }
  throw Error('Unexpected request in navigation fixture');
}`);
write('exports.ts', `
export async function fullFilteredExport(endpoint, filters) {
  window.__exports.push({endpoint, filters});
  return {rows:[{account_name:'Synthetic report evidence',amount:'12.00'}]};
}
export async function downloadAccountingExport() {}`);
write('empty.tsx', `export default function Empty() { return null; }`);
write('table.tsx', `
import React from 'react';
export default function Table({column,data}) {
  return <table><thead><tr>{column.map(c=><th key={c.id}>{c.Header}</th>)}</tr></thead>
    <tbody>{data.map((row,index)=><tr key={index}>{column.map(c=><td key={c.id}>{c.Cell({row:{original:row,index}})}</td>)}</tr>)}</tbody></table>;
}`);
write('entry.tsx', `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useSearchParams } from './navigation';
import { FinancialReportLinks, Register } from ${JSON.stringify(path.join(frontend, 'app', 'pharmacy', 'accounting', 'components', 'Registers'))};
import layout from ${JSON.stringify(path.join(frontend, 'app', 'pharmacy', 'accounting', 'components', 'AccountingWorkspace.module.css'))};
window.__requests=[]; window.__exports=[];window.__reviews=[];window.__reviewed=false;
function App() {
  useSearchParams();
  const section=location.pathname.endsWith('trial-balance')?'trial-balance':location.pathname.endsWith('statements')?'statements':'general-ledger';
  return <main className={layout.page}><h1>Pharmacy accounting</h1><FinancialReportLinks section={section}/>
    <Register endpoint={section==='general-ledger'?'ledger':'reports'} ledger={section==='general-ledger'}
      report={section==='general-ledger'?undefined:section==='trial-balance'?'trial_balance':'profit_loss'}/></main>;
}
createRoot(document.getElementById('root')).render(<App/>);`);

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

async function main() {
  let browser;
  try {
    const { webpack } = frontendModule('next/dist/compiled/webpack/webpack');
    const replacements = [
      [/^next\/link$/, 'link.tsx'], [/^next\/navigation$/, 'navigation.ts'],
      [/customFetch$/, 'fetch.ts'], [/^\.\/api$/, 'api.ts'], [/^\.\/exports$/, 'exports.ts'],
      [/SupplierPicker$|DateFilterReusable$|accessories\/Loader$/, 'empty.tsx'],
      [/accessories\/Datatables\/PrimeTable$/, 'table.tsx'],
    ];
    await new Promise((resolve, reject) => webpack({
      mode: 'development', devtool: false, entry: path.join(temporary, 'entry.tsx'),
      output: { path: temporary, filename: 'app.js' },
      resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], modules: [path.join(frontend, 'node_modules')] },
      module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(temporary, 'ts-loader.cjs') },
        { test: /\.css$/, use: path.join(temporary, 'css-loader.cjs') },
      ] },
      plugins: replacements.map(([pattern, file]) => new webpack.NormalModuleReplacementPlugin(pattern, resource => { resource.request = path.join(temporary, file); })),
    }, (error, stats) => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { chromium } = require('C:\\Users\\hamza\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright');
    browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/pharmacy/accounting/general-ledger`);
    const ledger = page.getByRole('region', { name: 'General ledger postings' });
    await ledger.waitFor();
    assert.equal(await ledger.locator('tbody').count(), 1);
    assert.equal(await ledger.locator('th[scope="rowgroup"] a').count(), 1);
    assert.match(await ledger.innerText(), /2 of 2 journal lines shown.*Balanced/);
    assert.equal(await ledger.getByRole('columnheader', { name: 'Account balance', exact: true }).count(), 0);
    assert.equal(await ledger.getByRole('columnheader', { name: 'Account code', exact: true }).count(), 1);
    const source = ledger.getByRole('link', { name: /Source evidence/ }).first();
    assert.match(await source.getAttribute('href'), /266a7e7d-5e3b-4d61-9a7a-f4a82ade9174#source-evidence$/);
    await page.locator('input[list="ledger-account-options"]').fill('collection:1');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await ledger.getByRole('columnheader', { name: 'Account balance', exact: true }).waitFor();
    assert.match(await ledger.innerText(), /Filtered journal/);
    assert.match(await ledger.innerText(), /100\.00 Dr/);
    assert.equal(await ledger.getByText('Unbalanced journal - investigate', { exact: true }).count(), 0);
    assert.equal(await ledger.locator('td').filter({ hasText: /^GH₵100.00 Dr$/ }).first().evaluate(element => getComputedStyle(element).textAlign), 'right');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await ledger.isVisible(), true);
    await page.emulateMedia({ media: 'screen' });
    console.log('PASS Ledger groups complete journals, separates accounts, flags filtered excerpts and shows actual Dr/Cr balances');
    await page.goto(`${base}/pharmacy/accounting/general-ledger`);
    const navigation = page.getByRole('navigation', { name: 'Financial reports' });
    await navigation.getByRole('link', { name: /Profit & loss/ }).waitFor();
    assert.equal(await navigation.locator('a').count(), 4);
    await navigation.getByRole('link', { name: /Cash flow/ }).click();
    await page.getByRole('heading', { name: 'Statement of Cash Flows', exact: true }).waitFor();
    assert.equal(await navigation.locator('[aria-current="page"]').getAttribute('href'), '/pharmacy/accounting/statements?report=cash_flow');
    const review = page.locator('details').filter({ hasText: 'Net movement is zero' });
    await review.locator('summary').click();
    assert.equal(await review.getByRole('button', { name: 'Save classification' }).isDisabled(), true);
    await review.getByLabel('operating cash inflow', { exact: true }).fill('100');
    await review.getByLabel('investing cash outflow', { exact: true }).fill('100');
    await review.getByLabel('Review reason / evidence', { exact: true }).fill('Reviewed synthetic sale and equipment payment');
    await review.getByRole('button', { name: 'Save classification' }).click();
    await page.waitForFunction(() => window.__reviews.length === 1);
    const reviewed = await page.evaluate(() => window.__reviews[0]);
    assert.equal(reviewed.body.allocations[0].inflow, 100);
    assert.equal(reviewed.body.allocations[1].outflow, 100);
    assert.match(reviewed.body.idempotencyKey, /^[a-f0-9-]{36}$/);
    assert.equal(await page.locator('table').count(), 1);
    console.log('PASS Zero-net compound cash review captures gross allocations, evidence and retry identity without another statement table');
    await page.getByLabel('From', { exact: true }).fill('2026-03-01');
    await page.getByLabel('To', { exact: true }).fill('2026-03-31');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await navigation.getByRole('link', { name: /Balance sheet/ }).click();
    await page.getByRole('heading', { name: /Statement of Financial Position/ }).waitFor();
    assert.equal(await page.locator('table').count(), 1);
    assert.deepEqual(await page.locator('th[scope="rowgroup"]').allTextContents(), ['Assets', 'Liabilities', 'Equity']);
    assert.equal(await page.getByText('Total assets', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Compact rows', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Profit is book revenue', { exact: false }).count(), 0);
    assert.equal(await page.locator('tfoot tr').filter({ hasText: 'Balance Difference' }).locator('td').textContent(), 'GH₵0.00');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('table').count(), 1);
    await page.emulateMedia({ media: 'screen' });
    assert.equal(await page.getByLabel('From', { exact: true }).inputValue(), '2026-03-01');
    await page.goBack();
    await page.getByRole('heading', { name: 'Statement of Cash Flows', exact: true }).waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: /Statement of Financial Position/ }).waitFor();
    await page.getByText('Export all filtered records', { exact: true }).click();
    await page.getByRole('button', { name: 'Excel · all filtered rows', exact: true }).click();
    const exported = await page.evaluate(() => window.__exports.at(-1));
    assert.equal(exported.filters.report, 'balance_sheet');
    assert.equal(exported.filters.from, '2026-03-01');
    assert.equal(exported.filters.to, '2026-03-31');
    console.log('PASS Direct reports, active links, history navigation, applied dates and export selection agree');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await navigation.getByRole('link', { name: /Balance sheet/ }).click();
      await page.getByRole('heading', { name: /Statement of Financial Position/ }).waitFor();
      assert.equal(await page.locator('table').count(), 1);
      const bank = page.getByRole('row').filter({ hasText: 'Synthetic bank' }).getByRole('cell').last();
      assert.equal(await bank.textContent(), '-GH₵100.00');
      assert.equal(await bank.evaluate(element => getComputedStyle(element).textAlign), 'right');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await navigation.getByRole('link', { name: /Profit & loss/ }).click();
      await page.getByRole('heading', { name: /Income Statement/ }).waitFor();
      const statement = page.getByRole('region', { name: /Income Statement.* table/ });
      assert.deepEqual(await statement.evaluate(element => {
        const style = getComputedStyle(element);
        return { x: style.overflowX, y: style.overflowY, maxHeight: style.maxHeight };
      }), { x: 'visible', y: 'visible', maxHeight: 'none' });
      assert.equal(await statement.getAttribute('tabindex'), null);
      await statement.locator('table').evaluate(element => { element.style.minWidth = '1800px'; });
      assert.equal(await statement.evaluate(element => element.scrollWidth > element.clientWidth), true, 'oversized content must remain unrestricted');
      assert.equal(await statement.evaluate(element => getComputedStyle(element).overflowX), 'visible');
      await statement.locator('table').evaluate(element => { element.style.removeProperty('min-width'); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      for (const link of await navigation.locator('a').all()) assert.equal(await link.isVisible(), true);
    }
    await navigation.getByRole('link', { name: /Trial balance/ }).click();
    await page.getByRole('heading', { name: 'Trial Balance', exact: true }).waitFor();
    await page.goto(`${base}/pharmacy/accounting/statements?report=invalid`);
    await page.getByRole('heading', { name: /Income Statement/ }).waitFor();
    await page.evaluate(() => { window.__fail = true; });
    await navigation.getByRole('link', { name: /Cash flow/ }).click();
    await page.getByRole('alert').filter({ hasText: 'Synthetic report unavailable' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Statement of Cash Flows', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS Single statement table, section/subtotal rows, print, right-aligned currency and mobile layout');
    console.log('PASS Profit & loss has visible horizontal/vertical overflow with no internal scroll or height restriction');
    console.log('PASS Desktop/mobile links remain visible; trial balance, invalid queries and report failure are handled');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

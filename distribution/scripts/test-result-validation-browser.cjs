const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const frontend = path.resolve(__dirname, "..", "..", "lobnos");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "pls-result-review-"));
const write = (name, content) => fs.writeFileSync(path.join(temporary, name), content);
const dependency = name => require(path.join(frontend, "node_modules", name));
write("loader.cjs", `
const ts=require(${JSON.stringify(path.join(frontend, "node_modules", "typescript"))});
module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;};`);
write("css.cjs", `
module.exports=function(source){
 const names=Object.fromEntries([...source.matchAll(/\\.([A-Za-z_][\\w-]*)/g)].map(match=>[match[1],match[1]]));
 return 'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.appendChild(style);export default '+JSON.stringify(names)+';';
};`);
write("context.jsx", `export function useApplicationSettings(){return {applicationsettings:{user:{employeeid:1},settings:{pinOnResultValidation:0}}};}`);
write("photo.jsx", `export default function usePatientImage(){return {loading:false,imageUrl:null,error:null};}`);
write("fetch.jsx", `
export const ResultEntrydefaultData={maximumResultValidation:3,minimumResultValidation:2};
export const getResultEntrySettings=async()=>ResultEntrydefaultData;
export const validatePin=async()=>({status:true});
export const generateRandomTextAndNumbers=n=>'x'.repeat(n);
export const formatDateOrNA=value=>value||'N/A';
export async function customPost(url,method,body){window.__writes.push({url,method,body});return {status:true,finalized:true};}
export async function customFetch(url){
 if(url.startsWith('register/'))return {result:{firstname:'Synthetic',lastname:'Patient',fullpatientid:'DEMO-001',gender:'female',age:35,ageType:'years',date:'2026-11-04'}};
 if(url.startsWith('test/approval'))return {staff:[{employeeid:2,username:'Recorded reviewer'}],approval_revision:4,requires_revalidation:true};
 if(url.startsWith('result/preview'))return {result:{testname:'ESR',result:[
  {plan:'textReference',name:'ESR',value:'5',units:'mm/hr',textReference:'ADULTS: 0 - 20,Long reference guidance remains readable without collapsing the value or unit columns.'},
  {plan:'limits',name:'Synthetic high parameter',value:'25',units:'unit',lowerlimit:5,upperlimit:20,flag:'H'},
  {plan:'limits',name:'Synthetic low parameter',value:'2',units:'unit',lowerlimit:5,upperlimit:20,flag:'L'},
  {plan:'limits',name:'Synthetic normal parameter',value:'10',units:'unit',lowerlimit:5,upperlimit:20}
 ]}};
 if(url.startsWith('testpanel/'))return {comments:'<p>Synthetic review comment.</p>'};
 throw Error('Unexpected fixture API');
}`);
write("toast.jsx", `export const toast={error(){},warn(){},info(){},success(){}};`);
write("entry.jsx", `
import React from 'react';
import {createRoot} from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import ValidationModal from ${JSON.stringify(path.join(frontend, "components", "operations", "Laboratory", "ValidationModal.jsx"))};
window.__writes=[];window.__closed=[];
const asc={ascensionid:7,id:3,patientid:9,billingid:11,name:'ESR',fullname:'Synthetic Patient'};
const selection=location.search.includes('bulk')?(location.search.includes('single')?[asc]:[asc,{...asc,ascensionid:8}]):asc;
createRoot(document.getElementById('root')).render(<ValidationModal show onClose={ids=>window.__closed.push(ids)} selectedAscension={selection} isBulk={location.search.includes('bulk')}/>);`);
const server = http.createServer((request, response) => {
    if (request.url === "/app.js") {
        response.setHeader("Content-Type", "application/javascript");
        response.end(fs.readFileSync(path.join(temporary, "app.js")));
    } else {
        response.setHeader("Content-Type", "text/html");
        response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    }
});
async function main() {
    let browser;
    try {
        const { webpack } = dependency("next/dist/compiled/webpack/webpack");
        await new Promise((resolve, reject) => webpack({
            mode: "development", devtool: false, entry: path.join(temporary, "entry.jsx"),
            output: { path: temporary, filename: "app.js" },
            resolve: { extensions: [".jsx", ".js", ".tsx", ".ts"], modules: [path.join(frontend, "node_modules")] },
            module: { rules: [
                { test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(temporary, "loader.cjs") },
                { test: /\.css$/, use: path.join(temporary, "css.cjs") },
            ] },
            plugins: [
                [/customFetch$/, "fetch.jsx"], [/useApplicationContext$/, "context.jsx"], [/usePatientImage$/, "photo.jsx"], [/^react-toastify$/, "toast.jsx"],
            ].map(([pattern, name]) => new webpack.NormalModuleReplacementPlugin(pattern, resource => { resource.request = path.join(temporary, name); })),
        }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
        const { chromium } = require("C:\\Users\\hamza\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright");
        browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        const base = `http://127.0.0.1:${server.address().port}`;
        await page.goto(base);
        const dialog = page.getByRole("dialog").first();
        await dialog.getByText("Synthetic review comment.", { exact: true }).waitFor();
        assert.equal(await dialog.locator("table").count(), 1);
        assert.ok((await dialog.boundingBox()).width > 1300, "review modal is wider than the previous 1200px cap");
        assert.equal(await dialog.getByText("Comments", { exact: true }).count(), 1);
        assert.equal(await dialog.getByText(/End of Report/).count(), 0);
        assert.equal(await dialog.getByText("Recorded reviewer", { exact: true }).count(), 1);
        assert.equal(await dialog.getByText("Synthetic Patient", { exact: true }).count(), 1);
        assert.equal(await dialog.getByRole("button", { name: "Record approval", exact: true }).isDisabled(), true);
        assert.equal(await dialog.locator('[aria-label="Patient initials"]').evaluate(el => Math.round(el.getBoundingClientRect().width)), 36);
        const review = await dialog.getByRole("region", { name: /Result review/ }).boundingBox();
        const approval = await dialog.getByRole("complementary", { name: "Approval review" }).boundingBox();
        assert.ok(review.width > 600 && approval.x >= review.x + review.width, "desktop separates the wider review from approval");
        assert.equal(await dialog.locator("td").nth(1).innerText(), "5");
        assert.equal(await dialog.locator("td").nth(2).innerText(), "mm/hr");
        await dialog.getByLabel("I have reviewed the patient details and current results.").check();
        await dialog.getByRole("button", { name: "Record approval", exact: true }).click();
        const writes = await page.evaluate(() => window.__writes);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.approval_revision, 4);
        assert.deepEqual(await page.evaluate(() => window.__closed), [7]);
        assert.equal(await page.getByText("Validation Successful", { exact: true }).count(), 0);
        const colours = await dialog.locator("tbody tr").evaluateAll(rows => rows.map(row => getComputedStyle(row.querySelector("td")).backgroundColor));
        assert.notEqual(colours[1], colours[3], "high flags have a distinct row background");
        assert.notEqual(colours[2], colours[3], "low flags have a distinct row background");
        assert.notEqual(colours[1], colours[2], "high and low flags use different colours");
        await page.evaluate(() => document.documentElement.setAttribute("data-bs-theme", "dark"));
        const darkColours = await dialog.locator("tbody tr").evaluateAll(rows => rows.map(row => getComputedStyle(row.querySelector("td")).backgroundColor));
        assert.notEqual(darkColours[1], colours[1], "flag backgrounds respond to dark theme");
        assert.notEqual(darkColours[1], darkColours[3]);
        console.log("PASS Wider desktop review retains identity/values, closes without a success popup, and reflects high/low row colours in both themes");
        await page.setViewportSize({ width: 390, height: 844 });
        const mobileReview = await dialog.getByRole("region", { name: /Result review/ }).boundingBox();
        const mobileApproval = await dialog.getByRole("complementary", { name: "Approval review" }).boundingBox();
        assert.ok(mobileApproval.y >= mobileReview.y + mobileReview.height, "mobile panels stack");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await dialog.getByRole("button", { name: "Record approval", exact: true }).scrollIntoViewIfNeeded();
        assert.equal(await dialog.getByRole("button", { name: "Record approval", exact: true }).isVisible(), true);
        console.log("PASS Mobile layout stacks panels, confines table scrolling and keeps approval accessible");
        await page.setViewportSize({ width: 1440, height: 950 });
        await page.goto(`${base}/?bulk`);
        await page.getByRole("button", { name: "Record all approvals", exact: true }).waitFor();
        await page.getByText("Synthetic review comment.", { exact: true }).first().waitFor();
        assert.equal(await page.locator("table").count(), 2);
        await page.getByLabel("I have reviewed the current results for every selected test.").check();
        await page.getByRole("button", { name: "Record all approvals", exact: true }).click();
        assert.deepEqual(await page.evaluate(() => window.__writes.map(write => write.body.ascensionid)), [7, 8]);
        assert.deepEqual(await page.evaluate(() => window.__closed), [[7, 8]]);
        await page.goto(`${base}/?bulk&single`);
        await page.getByText("Bulk Result Validation (1 test)", { exact: true }).waitFor();
        assert.ok((await page.getByRole("dialog").first().boundingBox()).width > 1300);
        assert.deepEqual(errors, []);
        console.log("PASS Bulk review preserves distinct test identities and existing approval workflow");
    } finally {
        if (browser) await browser.close();
        if (server.listening) await new Promise(resolve => server.close(resolve));
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const front=path.resolve('../lobnos'),out=path.resolve('tmp/workspace-learning-ui-'+process.pid);fs.mkdirSync(out,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(out,name),value),mod=name=>require(path.join(front,'node_modules',name));
write('ts-loader.cjs',`const ts=require(${JSON.stringify(path.join(front,'node_modules/typescript'))});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;}`);
write('css-loader.cjs',`const crypto=require('crypto');module.exports=function(source){const classes={};if(this.resourcePath.endsWith('.module.css')){const prefix='s'+crypto.createHash('sha1').update(this.resourcePath).digest('hex').slice(0,7)+'_';const globals=[];source=source.replace(/:global\\(([^)]+)\\)/g,(_,value)=>'GLOBALTOKEN'+(globals.push(value)-1)+'END');source=source.replace(/\\.([a-zA-Z_][a-zA-Z0-9_-]*)/g,(_,name)=>'.'+(classes[name]=prefix+name));source=source.replace(/GLOBALTOKEN(\\d+)END/g,(_,index)=>globals[Number(index)]);}return 'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.appendChild(style);export default '+JSON.stringify(classes)+';';}`);


write('context.ts',`export const useApplication=()=>{const p=new URLSearchParams(location.search);return {tenantId:Number(p.get('tenant')||876954),branchid:Number(p.get('branch')||4),user:{employeeid:3,role:p.get('role')||'admin'},settings:p.get('disabled')?{moduleConfiguration:{modules:{}}}:{}}};`);
write('api.ts',`export const customFetch=async()=>{const p=new URLSearchParams(location.search);await new Promise(resolve=>setTimeout(resolve,Number(p.get('delay')||0)));if(p.has('accessFailure'))throw Error('Unavailable');return {success:true,data:p.get('stock')==='none'?[]:[{department:'laboratory',can_request:true},{department:'imaging',can_receive:true}]}};`);
write('link.tsx',`import React from'react';export default function Link({children,href,...props}){const target=new URL(href,location.href);const match=target.pathname.match(/^\\/(operations|crm|billing|inventory)\\/guide(?:\\/([^?]+))?$/);if(match){const p=new URLSearchParams(location.search);p.set('module',match[1]);if(match[2])p.set('slug',match[2]);else p.delete('slug');if(target.searchParams.has('view'))p.set('view',target.searchParams.get('view'));else p.delete('view');href='?'+p;}return <a href={href} {...props}>{children}</a>}`);
write('entry.tsx',`import React from'react';import{createRoot}from'react-dom/client';import Page from ${JSON.stringify(path.join(front,'components/learning/WorkspaceLearningCenter'))};import{workspaceLearning,availableWorkspaceArticles}from ${JSON.stringify(path.join(front,'lib/workspaceLearning'))};import{canAccessRolePage}from ${JSON.stringify(path.join(front,'lib/roleNavigationPolicy'))};import 'bootstrap/dist/css/bootstrap.min.css';window.__learning={modules:workspaceLearning,availableWorkspaceArticles,canAccessRolePage};function App(){const[version,setVersion]=React.useState(0);window.changeContext=query=>{history.replaceState({},'','?'+query);setVersion(v=>v+1)};const p=new URLSearchParams(location.search);return <Page moduleId={p.get('module')||'billing'} slug={p.get('slug')||undefined} view={p.get('view')==='guides'?'guides':'manual'}/>;}createRoot(document.getElementById('root')).render(<App/>);`);
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?fs.readFileSync(path.join(out,'app.js')):'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script src="/app.js"></script></body></html>')});
(async()=>{
const {webpack}=mod('next/dist/compiled/webpack/webpack');const replacements=[[/useApplicationContext$/,'context.ts'],[/Auth[\\/]customFetch$/,'api.ts'],[/next\/link$/,'link.tsx']];
await new Promise((resolve,reject)=>webpack({mode:'development',devtool:false,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'app.js'},resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(front,'node_modules')]},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(out,'ts-loader.cjs')},{test:/\.css$/,use:path.join(out,'css-loader.cjs')}]},plugins:replacements.map(([pattern,file])=>new webpack.NormalModuleReplacementPlugin(pattern,item=>item.request=path.join(out,file)))},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const {chromium}=require('C:/Users/hamza/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('pageerror',error=>errors.push(error.message));const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/?view=guides');await page.getByRole('heading',{name:'Billing Learning Center',exact:true}).waitFor();
 const modules=await page.evaluate(()=>window.__learning.modules);
 const sectionNames=['How do I open this page?','What can I do on this page?','What am I looking at?','How do I complete the task?','What happens after I complete the task?','How do I check that it worked?','What if something goes wrong?','What should I do next?'];
 let articleCount=0,anchorCount=0;
 for(const module of modules){
  await page.goto(base+'/?module='+module.id+'&view=guides');await page.getByRole('heading',{name:module.title+' Learning Center',exact:true}).waitFor();
  await page.getByLabel('Search guides',{exact:true}).fill('zzzznotfound');await page.getByRole('heading',{name:'No matching guide'}).waitFor();
  await page.getByRole('button',{name:'Clear filters',exact:true}).first().click();assert(await page.getByLabel('Search guides',{exact:true}).evaluate(input=>input===document.activeElement));
  await page.getByLabel('Guide type',{exact:true}).selectOption('workflow');assert(await page.getByRole('link',{name:module.articles.find(article=>article.kind==='workflow').title,exact:false}).count()>0);
  await page.getByRole('button',{name:'Clear filters',exact:true}).first().click();
  await page.screenshot({path:'tmp/learning-audit-'+module.id+'-home-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'tmp/learning-audit-'+module.id+'-home-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  for(const article of module.articles){
   await page.goto(base+'/?module='+module.id+'&slug='+article.slug);await page.getByRole('heading',{name:article.title,exact:true,level:1}).waitFor();articleCount++;
   for(const name of sectionNames)assert.equal(await page.getByRole('heading',{name,exact:true}).count(),1,name);
   assert.equal(await page.getByRole('link',{name:'Open the task page',exact:true}).getAttribute('href'),article.entryRoutes?.[0]||article.route);
   const columns=await page.locator('aside[aria-label="Guide library"]').evaluate(el=>getComputedStyle(el.parentElement).gridTemplateColumns.split(' ').length);assert.equal(columns,3);
   const missing=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(href=>!document.getElementById(href.slice(1))));assert.deepEqual(missing,[]);anchorCount+=await page.locator('a[href^="#"]').count();
   const diagram=page.locator('figure[aria-labelledby]');assert.equal(await diagram.count(),article.kind==='workflow'?1:0);
   if(article.kind==='workflow')await page.screenshot({path:'tmp/learning-audit-'+module.id+'-workflow-desktop.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(article.kind==='workflow')await page.screenshot({path:'tmp/learning-audit-'+module.id+'-workflow-mobile.png',fullPage:true});
   await page.setViewportSize({width:1440,height:1000});
  }
 }

 // Continuous manuals have numbered procedures, valid contents anchors and current-role printing.
 await page.context().addInitScript(()=>{window.print=()=>{window.__didPrint=true};});
 for(const module of modules){
  await page.goto(base+'/?module='+module.id);
  await page.getByRole('heading',{name:module.title+' User Manual',exact:true}).waitFor();
  assert.equal(await page.locator('section[id^="procedure-"]').count(),module.articles.length);
  const missing=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(href=>!document.getElementById(href.slice(1))));assert.deepEqual(missing,[]);
  await page.getByLabel('Find a section',{exact:true}).fill('zzzzmissing');await page.getByText('0 matching procedures',{exact:true}).waitFor();assert.equal(await page.locator('section[id^="procedure-"]').count(),module.articles.length);await page.getByLabel('Find a section',{exact:true}).fill('');
  await page.screenshot({path:'tmp/manual-'+module.id+'-desktop.png'});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('button',{name:'Show contents',exact:true}).click();assert(await page.getByLabel('Find a section',{exact:true}).isVisible());await page.getByRole('button',{name:'Hide contents',exact:true}).click();assert(!(await page.getByLabel('Find a section',{exact:true}).isVisible()));await page.screenshot({path:'tmp/manual-'+module.id+'-mobile.png'});await page.setViewportSize({width:1440,height:1000});
 }
 await page.goto(base+'/?module=billing&role=cashier');await page.getByRole('heading',{name:'Billing User Manual',exact:true}).waitFor();assert.equal(await page.locator('#procedure-strategies').count(),0);assert.equal(await page.locator('#procedure-collect-payment').count(),1);
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Print manual',exact:true}).click();const popup=await popupPromise;await popup.getByRole('heading',{name:'Billing User Manual',exact:true}).waitFor();assert.equal(await popup.locator('#procedure-strategies').count(),0);assert.equal(await popup.locator('#procedure-collect-payment').count(),1);await popup.close();
 await page.evaluate(()=>{window.open=()=>null});await page.getByRole('button',{name:'Print manual',exact:true}).click();await page.getByRole('alert').getByText('Allow the manual print window to open, then try again.').waitFor();
 // Exercise actual in-library navigation and persisted reading progress.
 await page.goto(base+'/?module=crm&slug=practitioners');assert.equal(await page.getByText('Find referring practitioners flow',{exact:true}).count(),0);await page.getByRole('button',{name:'Mark as read',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Mark as unread',exact:true}).waitFor();
 await page.getByRole('link',{name:'All guides',exact:true}).first().click();await page.getByRole('heading',{name:'CRM User Manual',exact:true}).waitFor();await page.getByRole('link',{name:'Find a procedure',exact:true}).click();await page.getByRole('heading',{name:'CRM Learning Center',exact:true}).waitFor();
 await page.getByLabel('Search guides',{exact:true}).fill('contact');const guideLink=page.getByRole('link',{name:'Find referring practitioners',exact:false}).last();await guideLink.click();await page.getByRole('heading',{name:'Find referring practitioners',exact:true,level:1}).waitFor();
 for(const [module,role,slug,expected] of [['billing','cashier','billing-to-receipt','/billing/cash-collection'],['operations','nurse','vital-signs','/operations/laboratory/vitals/record-vital-sign'],['operations','scientist','lab-stock','/operations/laboratory/requisitions'],['operations','head of imaging','imaging-stock','/operations/imaging/ultrasound/requisitions']]){
  await page.goto(base+'/?'+new URLSearchParams({module,role,slug}));await page.getByRole('link',{name:'Open the task page',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Open the task page',exact:true}).getAttribute('href'),expected);
 }
 // A delayed grant from a previous tenant/branch cannot populate the replacement workspace.
 await page.goto(base+'/?module=operations&role=scientist&slug=lab-stock&delay=400');await page.evaluate(()=>window.changeContext('module=operations&role=scientist&slug=lab-stock&stock=none&tenant=77&branch=9'));await page.waitForTimeout(650);assert.equal(await page.getByRole('link',{name:'Open the task page',exact:true}).count(),0);
 for(const query of ['module=billing&role=cashier&slug=strategies','module=crm&role=patient&slug=registration','module=inventory&role=storekeeper&disabled=1&slug=items','module=billing&slug=unknown']){
  await page.goto(base+'/?'+query);await page.getByRole('heading',{name:'Guide unavailable',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Open the task page',exact:true}).count(),0);
 }
 await page.goto(base+'/?module=operations&role=scientist&slug=lab-stock&accessFailure=1');await page.getByRole('button',{name:'Retry access check',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Open the task page',exact:true}).count(),0);await page.evaluate(()=>history.replaceState({},'','?module=operations&role=scientist&slug=lab-stock'));await page.getByRole('button',{name:'Retry access check',exact:true}).click();await page.getByRole('link',{name:'Open the task page',exact:true}).waitFor();
 const blocked=await browser.newPage();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw Error('Storage disabled')};});await blocked.goto(base+'/?module=billing&slug=prepare-bill');await blocked.getByRole('button',{name:'Mark as read',exact:true}).click();await blocked.getByText('The reading marker could not be saved on this device.').waitFor();await blocked.close();
 assert.deepEqual(errors,[]);console.log(`PASS ${articleCount} lessons, ${anchorCount} in-page links, pharmacy section parity, three-column desktop and mobile layouts, workflow-only illustrations, search/type filters, role-specific task links, delayed grant isolation, retry controls and progress storage. Continuous manuals and scoped print copies verified. Context and stock access simulated; no operational records changed.`);
}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());

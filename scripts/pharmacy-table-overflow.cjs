const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../../lobnos/app/pharmacy');
fs.writeFileSync(path.join(root,'layout.module.css'),`.workspace {
  width: 100%; max-width: 100%; min-width: 0; contain: inline-size;
  box-sizing: border-box;
}
.workspace > *, .workspace main, .workspace section, .workspace article,
.workspace form, .workspace aside { min-width: 0; max-width: 100%; box-sizing: border-box; }
.workspace :global(.table-responsive) {
  display: block; width: 100%; max-width: 100%; min-width: 0;
  overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;
}
.workspace :global(.table-responsive):focus-visible { outline: 2px solid var(--bs-primary); outline-offset: 3px; }
.workspace table { width: 100%; border-collapse: collapse; }
.workspace table td { overflow-wrap: anywhere; }
.workspace :global(.row) > * { min-width: 0; }
`);
const layoutFile=path.join(root,'layout.tsx');let layout=fs.readFileSync(layoutFile,'utf8');if(!layout.includes("'./layout.module.css'"))layout=layout.replace("import { Suspense } from 'react';","import { Suspense } from 'react';\nimport styles from './layout.module.css';");layout=layout.replace('<div>{children}</div>','<div className={styles.workspace}>{children}</div>');fs.writeFileSync(layoutFile,layout);
const shared=path.join(root,'components/PharmacyWorkspace.module.css');let css=fs.readFileSync(shared,'utf8');css=css.replace('.page { padding: 24px;', '.page { width: 100%; min-width: 0; box-sizing: border-box; padding: 24px;');css=css.replace('.card { background:', '.card { min-width: 0; max-width: 100%; box-sizing: border-box; background:');css=css.replace('minmax(170px, 1fr)','minmax(min(170px, 100%), 1fr)');css=css.replace('.stat { border:', '.stat { min-width: 0; overflow-wrap: anywhere; border:');css=css.replace('white-space: nowrap; padding: 12px 14px;', 'white-space: normal; padding: 12px 14px;');css=css.replace('.search { max-width: 420px; flex: 1; min-width: 220px; }','.search { width: 100%; max-width: 420px; flex: 1 1 220px; min-width: 0; }');css=css.replace('.footer { display: flex;','.footer { display: flex; flex-wrap: wrap;');css+='\n.grid > *, .toolbar > *, .day > *, .dialogHeader > *, .header > * { min-width: 0; max-width: 100%; }\n.tabs { max-width: 100%; min-width: 0; }\n.dialog { min-width: 0; box-sizing: border-box; }\n.table td { overflow-wrap: anywhere; }\n';fs.writeFileSync(shared,css);
const pos=path.join(root,'sell/pos.module.css');let posCss=fs.readFileSync(pos,'utf8');posCss+='\n.page { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }\n.layout > *, .searchArea, .searchBox, .cartHeading, .basketFooter { min-width: 0; max-width: 100%; box-sizing: border-box; }\n.tableWrap { display: block; width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; overscroll-behavior-x: contain; }\n.table td:first-child { min-width: 150px; max-width: 340px; overflow-wrap: anywhere; }\n.heldList { grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr)); }\n.heldList > * { min-width: 0; overflow-wrap: anywhere; }\n';fs.writeFileSync(pos,posCss);
console.log('Applied pharmacy-wide table containment and responsive sizing.');

const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||(path.basename(__dirname)==='scripts'?path.join(__dirname,'../distribution'):__dirname));
if(!fs.existsSync(root)){console.error('Distribution package does not exist: '+root+'\nRun pnpm create-distribution first.');process.exitCode=1;}else{
 const required=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.env','knexfile.ts','dist/src/start.js','dist/src/app.js','db-exports/primelabmaster/tables-structure','db-exports/primelabmaster/seeds','public','scripts','node_modules/mysql2/package.json','node_modules/knex/package.json','node_modules/bcrypt/package.json','node_modules/dotenv/package.json'];
 const missing=required.filter(name=>!fs.existsSync(path.join(root,name)));
 if(missing.length){console.error('Distribution is incomplete:\n'+missing.join('\n'));process.exitCode=1;}else{
  try{require(path.join(root,'scripts/verify-distribution-exports.js')).verifyExports(root);console.log('Distribution application files and SQL exports verified.');}catch(error){console.error(error.message);process.exitCode=1;}
  if(!fs.existsSync(path.join(root,'node_modules'))){console.log('Production dependencies are not bundled. Install them before running this package.');}
 }
}

const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const ts=require(path.resolve('../lobnos/node_modules/typescript'));
const moduleTarget={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('../lobnos/lib/billing/allocateWaiver.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText)(moduleTarget,moduleTarget.exports);
const {allocateWaiver}=moduleTarget.exports;
assert.deepEqual(allocateWaiver([3850,5500,5500],4850),[1258,1796,1796]);
assert.deepEqual(allocateWaiver([1,1,1],1),[1,0,0]);
assert.deepEqual(allocateWaiver([0,0],0),[0,0]);
assert.deepEqual(allocateWaiver([100,200],999),[100,200]);
assert.throws(()=>allocateWaiver([1],-1));assert.throws(()=>allocateWaiver([1.5],1));
for(let target=0;target<=14850;target++){
 const balances=[3850,5500,5500],parts=allocateWaiver(balances,target);
 assert.equal(parts.reduce((a,b)=>a+b,0),target);
 parts.forEach((part,i)=>assert.ok(Number.isInteger(part)&&part>=0&&part<=balances[i]));
 assert.equal(balances.reduce((sum,b,i)=>sum+b-parts[i],0),14850-target);
}
console.log('Waiver allocation: exact reported example, deterministic ties, bounds, invalid inputs and all 14,851 possible waiver totals passed.');

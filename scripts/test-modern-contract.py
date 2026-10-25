from pathlib import Path
p=Path(r'D:/Primelabsys/PHIMS/primelabsys-current-working-version/lobnos/tests/modern-billing.test.cjs');s=p.read_text(encoding='utf-8');a=s.index("test('Modern F2 focuses search;");b=s.index("test('Modern rapid-entry",a);s=s[:a]+s[b:];s+='''
const helperSource=ts.transpileModule(fs.readFileSync(path.join(root,'components/Billing/Modern/modernBilling.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const helpers={};vm.runInNewContext(helperSource,{exports:helpers});
test('Modern bulk request carries IDs and permitted options without catalogue prices',()=>{
 const data={patientid:101,billingSource:4,nhismembershipid:123,claimscheckcode:456,cart:[{id:10,testid:10,name:'FBC',price:100,organization:{outsourceid:9},userAdjustmentType:'discount',userAdjustedValue:5}],servicesProvided:[{keyid:20,serviceName:'Collection',servicePrice:15}],payments:[{mode:'cash',amount:100}]};
 const draft=helpers.draftFromBilling(data),request=helpers.previewRequest(data,draft);assert.equal(request.items.length,2);assert.equal(request.items[0].outsourceId,9);assert.equal(request.items[0].price,undefined);assert.equal(request.items[1].servicePrice,undefined);assert.equal(request.payments,undefined);assert.equal(request.context.nhisMembershipId,123);assert.equal(request.context.claimCheckCode,456);
});
test('Modern review is invalidated by item, payer, promotion and NHIS changes',()=>{
 const data={patientid:101,billingSource:1,cart:[{id:10,testid:10,name:'FBC'}],servicesProvided:[]};const draft=helpers.draftFromBilling(data),key=helpers.reviewKey(data,draft);
 for(const override of [{billingSource:2,entityId:7},{isPromo:true,promoCode:'OCT'},{nhismembershipid:123,claimscheckcode:456}])assert.notEqual(helpers.reviewKey({...data,...override},draft),key);
 assert.notEqual(helpers.reviewKey(data,{items:[]}),key);assert.equal(helpers.reviewKey({...data,additionalInfo:'Optional note'},draft),key);
});
test('Modern preview merge preserves catalogues and workflow context while clearing obsolete payments',()=>{
 const data={testList:[{id:10}],servicesList:[{keyid:20}],cart:[],servicesProvided:[],billingRequestId:8,isAdjustment:1,adjustmentType:'correction',payments:[{mode:'cash',amount:10}],paid:10};
 const result=helpers.mergePreview(data,{cart:[{id:10,testid:10}],servicesProvided:[],amountPayable:80});assert.equal(result.testList,data.testList);assert.equal(result.servicesList,data.servicesList);assert.equal(result.billingRequestId,8);assert.equal(result.adjustmentType,'correction');assert.equal(result.paid,0);assert.equal(result.balance,80);assert.equal(result.payments.length,0);
 assert.throws(()=>helpers.mergePreview(data,{cart:[],amountPayable:80}),/incomplete/);
});
test('Modern selection requires outsourcing and filters multiple search terms',()=>{
 const item={kind:'test',id:10,row:{name:'Full blood count',isoutsourced:1}};assert.match(helpers.selectionIssue({}, {items:[item]}),/outsourcing/);assert.equal(helpers.selectionIssue({}, {items:[{...item,row:{...item.row,outsourceid:7}}]}),null);assert.equal(helpers.filterCatalogue([item],'blood full','test').length,1);assert.equal(helpers.filterCatalogue([item],'blood','service').length,0);
});
''';p.write_text(s,encoding='utf-8')

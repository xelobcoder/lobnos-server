const fs=require('fs'),path=require('path');const file=path.resolve(__dirname,'../../lobnos/app/pharmacy/sell/page.tsx');let s=fs.readFileSync(file,'utf8');
function sub(a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,80));s=s.replace(a,b);}
sub("const [search,setSearch]=useState('')","const [quantityDraft,setQuantityDraft]=useState<Record<string,string>>({}),[scanning,setScanning]=useState(0);\n     const scanQueue=useRef(Promise.resolve()),scanCount=useRef(0),addLatest=useRef<(item:Medicine)=>void>(()=>{}),cartRef=useRef<Line[]>([]);\n     const [search,setSearch]=useState('')");
sub("const locked=busy||!!payment.pending||!!suspension.pending,total=", "cartRef.current=cart;\n     const locked=busy||!!payment.pending||!!suspension.pending,total=");
sub('          if(locked)return;','          if(locked||busyRef.current)return;');
sub('const existing=cart.find(line=>line.inventoryItemId===item.inventoryItemId)', 'const existing=cartRef.current.find(line=>line.inventoryItemId===item.inventoryItemId)');
sub('setCart(rows=>existing?rows.map(line=>line.inventoryItemId===item.inventoryItemId?{...line,...item,quantity:next}:line):[...rows,{...item,quantity:1}]);','const updated=existing?cartRef.current.map(line=>line.inventoryItemId===item.inventoryItemId?{...line,...item,quantity:next}:line):[...cartRef.current,{...item,quantity:1}];cartRef.current=updated;setCart(updated);');
sub('     const setQuantity=',`     addLatest.current=add;
     const enqueueScan=(term:string,cached:Medicine[],chosen:number)=>{
          scanCount.current++;setScanning(scanCount.current);setSearch('');setItems([]);generation.current++;
          scanQueue.current=scanQueue.current.then(async()=>{
               let rows=cached;
               if(!rows.length){const r=await customFetch('pharmacy/catalogue?sellableOnly=true&count=20&search='+encodeURIComponent(term));if(!r?.success)throw new Error(r?.error?.message||'Unable to look up scanned medicine');rows=r.data.items||[];}
               const item=rows.find(item=>item.sku.toLowerCase()===term.toLowerCase())||rows[chosen]||rows[0];
               if(!item)throw new Error('No medicine found for '+term);addLatest.current(item);
          }).catch(error=>setError(error instanceof Error?error.message:'Unable to add scanned medicine')).finally(()=>{scanCount.current--;setScanning(scanCount.current);});
     };
     const setQuantity=`);
s=s.replaceAll('if(busyRef.current||suspension.pending||', 'if(scanCount.current||busyRef.current||suspension.pending||').replaceAll('if(busyRef.current||payment.pending||','if(scanCount.current||busyRef.current||payment.pending||');
sub("if(types.size!==1)throw new Error('This older suspended sale contains mixed prices. Review it before checkout.');",'');
sub("setNotice('Suspended sale recalled. Current prices and stock are checked before checkout.');", "setNotice(types.size>1?'This older suspension used mixed prices. All items now use '+type+' pricing; review the total.':'Suspended sale recalled. Current prices and stock are checked before checkout.');");
s=s.replaceAll('setCart([]);','setCart([]);setQuantityDraft({});');
sub('aria-controls="medicine-options"','aria-controls="medicine-options" aria-autocomplete="list"');
sub("onChange={event=>{setSearch(event.target.value);setItems([]);}}", "onChange={event=>{setSearch(event.target.value);setItems([]);setLoading(!!event.target.value.trim());}}");
sub("const rows=resultsFor.current===term?items:await lookup(term);const exact=rows.find(item=>item.sku.toLowerCase()===term.toLowerCase());const item=exact||rows[active]||rows[0];if(item)add(item);", "enqueueScan(term,resultsFor.current===term?items:[],active);");
sub('<h2>Basket <span>{cart.length} item(s)</span></h2>','<h2>Basket <span>{scanning?\'Adding scanned medicines…\':cart.length+\' item(s)\'}</span></h2>');
sub('required value={line.quantity} disabled={locked} onChange={event=>setQuantity(line.inventoryItemId,Number(event.target.value))}',`required max={line.dispensableStock??line.availableStock} value={quantityDraft[line.inventoryItemId]??line.quantity} disabled={locked} onChange={event=>{const value=event.target.value;setQuantityDraft(draft=>({...draft,[line.inventoryItemId]:value}));if(Number(value)>0)setQuantity(line.inventoryItemId,Number(value));}} onBlur={()=>setQuantityDraft(draft=>{const next={...draft};delete next[line.inventoryItemId];return next;})} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();focusSearch();}}}`);
s=s.replaceAll('disabled={locked||!cart.length}', 'disabled={locked||!!scanning||!cart.length}').replaceAll('disabled={locked||!cart.length||', 'disabled={locked||!!scanning||!cart.length||');
sub('setPriceType(type);setCart(r.data.lines.map','setQuantityDraft({});setPriceType(type);setCart(r.data.lines.map');
fs.writeFileSync(file,s);

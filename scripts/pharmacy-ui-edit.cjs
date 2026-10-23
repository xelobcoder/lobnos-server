const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../../lobnos');
function sub(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,90));return s.replace(a,b);}
function edit(file,fn){const p=path.join(root,file);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
fs.copyFileSync(path.join(__dirname,'PharmacyPaymentFields.tsx'),path.join(root,'app/pharmacy/components/PharmacyPaymentFields.tsx'));
edit('app/pharmacy/components/PharmacyPaymentFields.tsx',s=>s.replace('application?.tenantId',"(application as any)?.tenantId"));
edit('app/pharmacy/sell/page.tsx',s=>{
 s=sub(s,"import styles from '../pharmacy.module.css';","import styles from '../pharmacy.module.css';\nimport PharmacyPaymentFields,{usePharmacyPayment} from '../components/PharmacyPaymentFields';");
 s=sub(s,'     availableStock: number;','     availableStock: number;\n     dispensableStock?:number;\n     requiresPrescription?:boolean;');
 s=sub(s,'     const application = useApplication();',"     const payment=usePharmacyPayment('pos');\n     const application = useApplication();");
 s=s.replaceAll('response.data.items || []',"(response.data.items || []).map((item:Medicine)=>({...item,availableStock:item.dispensableStock??item.availableStock}))");
 s=sub(s,'     const subtotal = cart.reduce((total, line) => total + line.salePrice * line.quantity, 0);','     const subtotal = cart.reduce((cents, line) => cents + Math.round(Math.round(line.salePrice*100)*Math.round(line.quantity*1000)/1000), 0)/100;');
 s=sub(s,'          setReceipt(null);',"          if(payment.pending){setError('Resolve the pending checkout before changing the cart.');return;}\n          if(medicine.requiresPrescription){setError('This medicine requires a prescription. Open the prescription queue to dispense it.');return;}\n          setReceipt(null);");
 const start=s.indexOf('     const completeSale = async (event: FormEvent)'),end=s.indexOf('     const cartHtmlContent',start);if(start<0||end<0)throw Error('Missing checkout');
 s=s.slice(0,start)+`     const runCheckout=async()=>{
          if(submitting||(!cart.length&&!payment.pending))return;
          setSubmitting(true);setError('');
          try {
               const endpoint=activeHeldSaleId ? 'pharmacy/sales/held/'+activeHeldSaleId+'/complete' : 'pharmacy/sales';
               const response=await payment.execute(endpoint,{customerName:customerName||'Walk-in customer',paymentMethod,expectedTotal:subtotal,lines:cart.map(line=>({inventoryItemId:line.inventoryItemId,quantity:line.quantity}))});
               if(!response?.success)throw new Error(response?.error?.message||'Checkout could not be confirmed. Retry the pending checkout.');
               setReceipt({...response.data,lines:response.data.lines.map((line:any)=>({...line,salePrice:line.unitPrice}))});
               setCart([]);setCustomerName('');setActiveHeldSaleId(null);setIsMobileCartOpen(false);
          }catch(error){setError(error instanceof Error?error.message:'Unable to confirm checkout.');}finally{setSubmitting(false);}
     };
     const completeSale=async(event:FormEvent)=>{event.preventDefault();await runCheckout();};

`+s.slice(end);
 s=sub(s,'                    {/* Payment methods list */}','                    <PharmacyPaymentFields payment={payment} method={paymentMethod} disabled={submitting}/>\n                    {/* Payment methods list */}');
 s=sub(s,'               {error && (',`               {payment.pending&&<div className="alert alert-warning">A previous checkout needs confirmation. <button type="button" className="btn btn-warning" disabled={submitting} onClick={runCheckout}>Retry original checkout</button></div>}
               <p className="small"><Link href="/pharmacy/prescriptions">Open prescription dispensing</Link></p>
               {error && (`);
 s=s.replaceAll('disabled={cart.length === 0 || submitting}','disabled={cart.length === 0 || submitting || !!payment.pending}');
 return s;
});
edit('app/pharmacy/prescriptions/page.tsx',s=>{
 s=sub(s,"import styles from '../pharmacy.module.css';","import styles from '../pharmacy.module.css';\nimport PharmacyPaymentFields,{usePharmacyPayment} from '../components/PharmacyPaymentFields';");
 s=sub(s,'     quantityOrdered: number;','     availableStock?:number;\n     salePrice?:number;\n     quantityOrdered: number;');
 s=sub(s,'type PrescriptionDetail = {','type PrescriptionDetail = {\n     patientName?:string;');
 s=sub(s,"     const [statusFilter", "     const payment=usePharmacyPayment('prescription');\n     const [notice,setNotice]=useState('');\n     const [statusFilter");
 s=sub(s,"if (item.status === 'pending') outstanding[item.id] = item.quantityOrdered - item.quantityDispensed;","if (item.status === 'pending') outstanding[item.id] = 0;");
 const start=s.indexOf('     const fulfillSelected = async () => {'),end=s.indexOf('     const referRemaining = async () => {',start);
 if(start<0||end<0)throw Error('Missing fulfill handler');
 s=s.slice(0,start)+`     const dispensingTotal=selected?selected.items.reduce((cents,item)=>cents+Math.round(Math.round((item.salePrice||0)*100)*Math.round((dispenseQuantities[item.id]||0)*1000)/1000),0)/100:0;
     const fulfillSelected=async()=>{
          if(submitting||(!selected&&!payment.pending))return;
          const lines=Object.entries(dispenseQuantities).filter(([,quantity])=>quantity>0).map(([prescriptionItemId,quantityDispensed])=>({prescriptionItemId,quantityDispensed}));
          if(!payment.pending){
               if(!lines.length){setDetailError('Enter quantities for the drugs you intend to dispense.');return;}
               if(!payment.accountId||(paymentMethod!=='cash'&&!payment.reference.trim())){setDetailError('Select the collection account and enter the payment reference.');return;}
               if(!window.confirm('Dispense selected medicines for '+(selected?.patientName||'patient #'+selected?.patientId)+' and record GHS '+dispensingTotal.toFixed(2)+' received?'))return;
          }
          setSubmitting(true);setDetailError('');
          try {
               const response=await payment.execute('prescriptions/'+selected?.id+'/fulfill',{lines,paymentMethod,customerName:selected?.patientName,expectedTotal:dispensingTotal});
               if(!response?.success)throw new Error(response?.error?.message||'Dispensing could not be confirmed. Retry the original request.');
               setNotice('Dispensing recorded. Receipt '+response.data.receipt.receiptNumber+' — GHS '+Number(response.data.receipt.total).toFixed(2));
               closeDetail();await loadPrescriptions(1,DEFAULT_PAGE_SIZE);
          }catch(error){setDetailError(error instanceof Error?error.message:'Dispensing could not be confirmed');}finally{setSubmitting(false);}
     };

`+s.slice(end);
 s=sub(s,'          if (!selected) return;\n          setSubmitting(true);',"          if (!selected||submitting||payment.pending) return;\n          if(!window.confirm('Refer all remaining medicines outside this pharmacy?'))return;\n          setSubmitting(true);");
 s=sub(s,'               {error && <div',`               {notice&&<div className="alert alert-success" role="status">{notice}</div>}
               {payment.pending&&<div className="alert alert-warning">A dispensing request needs confirmation. <button className="btn btn-warning" disabled={submitting} onClick={fulfillSelected}>Retry original dispensing</button></div>}
               {!selected&&detailError&&<div className="alert alert-danger" role="alert">{detailError}</div>}
               {error && <div`);
 s=sub(s,'                                        {detailError &&',`                                        <p className="fw-semibold">{selected.patientName||'Patient'} · Patient #{selected.patientId}</p>
                                        <p className="small text-muted">Review the patient, directions, available stock and quantities before collecting payment.</p>
                                        {detailError &&`);
 s=sub(s,'                                                            <td>{item.quantityOrdered}</td>',`                                                            <td>{item.quantityOrdered}<div className="small text-muted">Available: {item.availableStock||0}<br/>GHS {Number(item.salePrice||0).toFixed(2)} / unit</div></td>`);
 s=sub(s,'max={item.quantityOrdered - item.quantityDispensed}', 'max={Math.min(item.quantityOrdered - item.quantityDispensed,item.availableStock||0)} step="0.001" disabled={submitting||!!payment.pending||!item.inventoryItemId}');
 s=sub(s,'                                        <div className="d-flex align-items-center gap-2">',`                                        <p className="fw-bold">Amount to collect: GHS {dispensingTotal.toFixed(2)}</p>
                                        <PharmacyPaymentFields payment={payment} method={paymentMethod} disabled={submitting}/>
                                        <div className="d-flex align-items-center gap-2">`);
 s=s.replaceAll('disabled={submitting} onClick={referRemaining}','disabled={submitting||!!payment.pending} onClick={referRemaining}').replaceAll('disabled={submitting} onClick={fulfillSelected}','disabled={submitting||!!payment.pending} onClick={fulfillSelected}');
 return s;
});
edit('app/pharmacy/sales-history/page.tsx',s=>{
 s=sub(s,"     const [reversalType, setReversalType]", "     const [disposition,setDisposition]=useState<'restock'|'quarantine'|'not_returned'>('quarantine');\n     const [reversalType, setReversalType]");
 s=sub(s,"          setReversalType('refund');", "          setDisposition('quarantine');\n          setReversalType('refund');");
 s=sub(s,'{ type: reversalType, reason: effectiveReason }','{ type: reversalType, reason: effectiveReason, disposition }');
 s=sub(s,'                                             <label className="form-label mt-3" htmlFor="reversal-reason-select">Reason</label>',`                                             <label className="form-label mt-3" htmlFor="return-disposition">What happened to the goods?</label>
                                             <select id="return-disposition" className="form-select" value={disposition} disabled={submitting} onChange={event=>setDisposition(event.target.value as typeof disposition)}><option value="quarantine">Returned — quarantine, exclude from saleable stock</option><option value="not_returned">Goods were not returned — leave stock and dispensing unchanged</option><option value="restock">Returned and checked — restore to the original batches</option></select>
                                             <p className="small text-muted mt-2">Confirm that the full refund has been issued through the original collection account. The refund and goods disposition will be recorded separately. Expired goods cannot be restocked.</p>
                                             <label className="form-label mt-3" htmlFor="reversal-reason-select">Reason</label>`);
 s=s.replace('Money is returned to the customer and the goods come back into stock.','Record the full refund and choose how to handle the goods.').replace('The sale was recorded in error and is nullified. Stock is returned.','Correct a sale recorded in error; confirm payment reversal and goods disposition.').replace('The sale is cancelled before the customer took the goods. Stock is returned.','Cancel the completed sale with a full payment reversal and an explicit stock choice.');return s;
});
edit('app/pharmacy/components/PharmacyStockUpModal.tsx',s=>{
 s=sub(s,'     salePrice: number;','     salePrice: number;\n     batchTracking?:boolean;');
 s=sub(s,"     const [expiryDate, setExpiryDate] = useState('');","     const [expiryDate, setExpiryDate] = useState('');\n     const [batchNumber,setBatchNumber]=useState('');");
 s=sub(s,"          setExpiryDate('');","          setExpiryDate('');setBatchNumber('');");
 s=sub(s,'     const receiveStock = async () => {',"     const receiveStock = async () => {\n          if(item.batchTracking!==false&&(!expiryDate||expiryDate<new Date().toISOString().slice(0,10)||!batchNumber.trim())){toast.error('Enter the manufacturer batch number and a valid expiry date.');return;}");
 s=sub(s,'                    expiry_date: expiryDate || undefined,','                    expiry_date: expiryDate || undefined,\n                    batch_number:batchNumber.trim()||undefined,');
 s=sub(s,'Expiry date <span className="text-muted fw-normal">(optional)</span>','Expiry date');
 s=sub(s,'<input id="stock-expiry" type="date"','<input id="stock-expiry" min={new Date().toISOString().slice(0,10)} required={item.batchTracking!==false} type="date"');
 s=sub(s,'<div className="col-md-6"><label className="form-label fw-semibold" htmlFor="stock-expiry">', '<div className="col-md-6"><label className="form-label fw-semibold" htmlFor="manufacturer-batch">Manufacturer batch number</label><input id="manufacturer-batch" className="form-control form-control-lg" value={batchNumber} maxLength={100} onChange={event=>setBatchNumber(event.target.value)}/></div><div className="col-md-6"><label className="form-label fw-semibold" htmlFor="stock-expiry">');
 return s.replace('Batch number generated automatically.','Batch and expiry details recorded.');
});
edit('app/pharmacy/catalogue/page.tsx',s=>{
 s=sub(s,"import { customFetch }", "import { customFetch, customFetchMutation }");
 s=sub(s,'     availableStock: number;','     availableStock: number;\n     dispensableStock?:number;\n     requiresPrescription?:boolean;\n     batchTracking?:boolean;');
 s=sub(s,'     const employeeId =',"     const role=String(useApplicationSettings().applicationsettings?.user?.role||'').toLowerCase().replace(/[ _-]/g,'');\n     const canConfigure=['superadmin','admin','manager','pharmacymanager'].includes(role);\n     const [profile,setProfile]=useState<CatalogueItem|null>(null),[profileBusy,setProfileBusy]=useState(false);\n     const employeeId =");
 s=sub(s,'     const columns = [',`     const saveProfile=async()=>{
          if(!profile||profileBusy)return;setProfileBusy(true);
          try{const response=await customFetchMutation('pharmacy/catalogue/'+profile.inventoryItemId+'/profile','PUT',{requiresPrescription:!!profile.requiresPrescription,batchTracking:profile.batchTracking!==false});if(!response?.success)throw new Error(response?.error?.message||'Unable to update dispensing controls');setProfile(null);await loadCatalogue(1,DEFAULT_PAGE_SIZE,appliedSearch,sortBy,sortDirection);}catch(error){setError(error instanceof Error?error.message:'Unable to save');}finally{setProfileBusy(false);}
     };
     const columns = [`);
 s=sub(s,'     const columns = [','     const columns = [\n          {Header:"Dispensing controls",accessor:"controls",Cell:({row}:{row:{original:CatalogueItem}})=><div><div className="small">{row.original.requiresPrescription?"Prescription required":"Walk-in sale allowed"} · {row.original.batchTracking!==false?"Batch and expiry required":"General merchandise"}</div><div className="small text-muted">Dispensable: {row.original.dispensableStock||0}</div>{canConfigure&&<button className="btn btn-sm btn-outline-secondary mt-1" onClick={()=>setProfile({...row.original})}>Configure</button>}</div>},');
 s=sub(s,'               <PrimeTable',`               {profile&&<div className="modal d-block" role="dialog" aria-modal="true" aria-label="Dispensing controls" style={{background:'rgba(0,0,0,.4)'}}><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h2 className="h5 mb-0">Dispensing controls · {profile.name}</h2><button className="btn-close" disabled={profileBusy} onClick={()=>setProfile(null)} aria-label="Close"/></div><div className="modal-body"><label className="form-check"><input className="form-check-input" type="checkbox" checked={!!profile.requiresPrescription} onChange={event=>setProfile({...profile,requiresPrescription:event.target.checked})}/>Prescription required</label><label className="form-check mt-3"><input className="form-check-input" type="checkbox" checked={profile.batchTracking!==false} onChange={event=>setProfile({...profile,batchTracking:event.target.checked})}/>Require manufacturer batch and expiry</label><p className="small text-muted mt-2">Keep batch and expiry tracking enabled for medicines. Disable it only for general merchandise that does not require expiry tracking. Changes are audited.</p></div><div className="modal-footer"><button className="btn btn-primary" disabled={profileBusy} onClick={saveProfile}>{profileBusy?'Saving…':'Save controls'}</button></div></div></div></div>}
               <PrimeTable`);return s;
});

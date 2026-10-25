from pathlib import Path
p=Path(r'D:/Primelabsys/PHIMS/primelabsys-current-working-version/lobnos/components/Billing/Multi/MultBillingLayout.tsx');s=p.read_text(encoding='utf-8')
s=s.replace("import ModernBillingWorkspace from '../Modern/ModernBillingWorkspace';","import ModernBillingWorkspace from '../Modern/ModernBillingWorkspace';\nimport type { ModernDraft } from '../Modern/modernBilling';")
s=s.replace("    const [layout,setLayout]=useState<'classic'|'modern'>('classic');","    const [layout,setLayout]=useState<'classic'|'modern'>('classic');\n    const layoutGuardRef=useRef<(() => Promise<boolean>) | null>(null);")
s=s.replace("    const chooseLayout=(next:'classic'|'modern')=>{setLayout(next);try{localStorage.setItem(layoutPreferenceKey,next);}catch{ /* Choice remains available for this session. */ }};", "    const chooseLayout=async(next:'classic'|'modern')=>{if(next===layout)return;if(layout==='modern'&&layoutGuardRef.current&&!(await layoutGuardRef.current()))return;setLayout(next);try{localStorage.setItem(layoutPreferenceKey,next);}catch{ /* Choice remains available for this session. */ }};")
s=s.replace("<MultiBillingLayoutContent modern={layout==='modern'}/>","<MultiBillingLayoutContent modern={layout==='modern'} layoutGuardRef={layoutGuardRef}/>")
s=s.replace('function MultiBillingLayoutContent({modern=false}:{modern?:boolean}) {\n    const [modernEntryDraft,setModernEntryDraft]=useState<any>({selected:null,selectedOutsource:null,organizations:[]});','function MultiBillingLayoutContent({modern=false,layoutGuardRef}:{modern?:boolean;layoutGuardRef?:React.MutableRefObject<(() => Promise<boolean>) | null>}) {\n    const [modernEntryDraft,setModernEntryDraft]=useState<ModernDraft|null>(null);\n    const internalLayoutGuard=useRef<(() => Promise<boolean>) | null>(null);')
s=s.replace('setModernEntryDraft({selected:null,selectedOutsource:null,organizations:[]})','setModernEntryDraft(null)')
start=s.index('                catalogue={loadingPanels?');end=s.index('                loading={loadingPanels}',start)
s=s[:start]+'''                draft={modernEntryDraft} setDraft={setModernEntryDraft}
                layoutGuardRef={layoutGuardRef||internalLayoutGuard}
                onContinue={handleAdvancedPayment} onSubmit={handleSubmit}
'''+s[end:]
p.write_text(s,encoding='utf-8')
p=Path(r'D:/Primelabsys/PHIMS/primelabsys-current-working-version/lobnos/tests/billing-workflow.test.cjs');s=p.read_text(encoding='utf-8').replace('node.props?.catalogue&&node.props?.summary','node.props?.onContinue&&node.props?.onSubmit')
s=s.replace(' assert.equal(modern.props.catalogue.props.addFirst,true);\n modern.props.catalogue.props.setEntryDraft({selected:{id:99,name:\'Pending test\'},selectedOutsource:null,organizations:[]});'," modern.props.setDraft({items:[{kind:'test',id:99,row:{id:99,name:'Pending test'}}]});")
s=s.replace('await modern.props.summary.props.handlesubmit(h.data);','await modern.props.onSubmit(h.data);').replace('restored.props.catalogue.props.entryDraft.selected.id','restored.props.draft.items[0].id')
p.write_text(s,encoding='utf-8')

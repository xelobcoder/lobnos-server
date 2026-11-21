export const RESULT_TYPES=['numeric','text','coded','narrative','time','date','datetime','ultrasound','fetalBiometry'] as const;
export const REFERENCE_MODES=['none','interval','demographic','text','comparison'] as const;
const bad=(message:string)=>Object.assign(new Error(message),{statusCode:400});
export function inferredDefinition(rule:any){
 const plan=rule.plan;
 const numeric=['limits','greaterLess','greaterLessEqualTo'].includes(plan);
 return {result_type:rule.result_type || (numeric?'numeric':({options:'coded',plain:'narrative',ultrasoundFields:'ultrasound',fetalBiometry:'fetalBiometry',time:'time',date:'date',datetime:'datetime'} as any)[plan]||'text'),
 reference_mode:rule.reference_mode || (plan==='limits'?(['lowerLimitMale','upperLimitMale','lowerLimitFemale','upperLimitFemale','lowerLimitChildren','upperLimitChildren','lowerLimitNeonates','upperLimitNeonates'].some(k=>rule[k]!==null&&rule[k]!==undefined&&rule[k]!=='')?'demographic':'interval'):plan==='textReference'?'text':['greaterLess','greaterLessEqualTo'].includes(plan)?'comparison':'none')};
}
export function definitionForSave(rule:any){
 // Legacy rows and legacy callers keep their exact renderer and reference data.
 if(!rule.result_type&&!rule.reference_mode)return {};
 const {result_type:type,reference_mode:mode}=inferredDefinition(rule);
 if(!RESULT_TYPES.includes(type)||!REFERENCE_MODES.includes(mode))throw bad('Unknown result type or reference mode');
 if(['interval','demographic','comparison'].includes(mode)&&type!=='numeric')throw bad('Numeric reference rules require a numeric result type');
 if(mode==='text'&&type!=='text')throw bad('Text reference is not supported for this result type');
 if(mode==='comparison'&&!/^(?:<=|>=|<|>)\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(rule.textReference||'').trim()))throw bad('Enter a comparison such as <5 or >=10');
 if(type==='numeric'&&mode==='text')throw bad('Use interval, demographic or comparison references for numeric results');
 if(['interval','demographic'].includes(mode)){
  const pairs=mode==='interval'?[['lowerlimit','upperlimit']]:[['lowerLimitMale','upperLimitMale'],['lowerLimitFemale','upperLimitFemale'],['lowerLimitChildren','upperLimitChildren'],['lowerLimitNeonates','upperLimitNeonates']];
  for(const [lo,hi] of pairs){const l=rule[lo]??(lo==='lowerlimit'?rule.lowerLimit:null),h=rule[hi]??(hi==='upperlimit'?rule.upperLimit:null);
   if([l,h].some(v=>v!==null&&v!==undefined&&v!==''&&!Number.isFinite(Number(v))))throw bad('Reference limits must be finite numbers');
   if(l!==null&&l!==undefined&&l!==''&&h!==null&&h!==undefined&&h!==''&&Number(l)>Number(h))throw bad('Lower reference limit cannot exceed the upper limit');
  }
 }
 let plan=({numeric:'input',text:'input',coded:'options',narrative:'plain',ultrasound:'ultrasoundFields',fetalBiometry:'fetalBiometry',time:'time',date:'date',datetime:'datetime'} as any)[type];
 if(type==='numeric'&&['interval','demographic'].includes(mode))plan='limits';
 if(type==='numeric'&&mode==='comparison')plan=/[<>]=/.test(rule.textReference||'')?'greaterLessEqualTo':'greaterLess';
 if(type==='text'&&mode==='text')plan='textReference';
 return {result_type:type,reference_mode:mode,plan};
}
export function validateTypedResult(rule:any,value:unknown){
 if(rule.result_type!=='numeric'||value===null||value===undefined||String(value).trim()==='')return;
 const raw=String(value).trim();
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)||!Number.isFinite(Number(raw)))throw bad(`Enter a valid numeric result for ${rule.name||'this parameter'}`);
}

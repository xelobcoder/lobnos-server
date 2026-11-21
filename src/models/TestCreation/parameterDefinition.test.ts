import {expect,it} from 'vitest';
import {definitionForSave,inferredDefinition,validateTypedResult} from './parameterDefinition';
it('infers legacy definitions without migrating their stored configuration',()=>{
 for(const rule of [{plan:'input',units:'sec'},{plan:'limits',lowerlimit:0,upperlimit:10},{plan:'greaterLessEqualTo',textReference:'<=5'},{plan:'options',options:'Positive,Negative'}]){
 const before=JSON.stringify(rule);expect(definitionForSave(rule)).toEqual({});inferredDefinition(rule);expect(JSON.stringify(rule)).toBe(before);
 }
 expect(inferredDefinition({plan:'limits',lowerLimitFemale:0})).toMatchObject({result_type:'numeric',reference_mode:'demographic'});
});
it('separates numeric entry from optional reference rules and retains zero',()=>{
 expect(definitionForSave({result_type:'numeric',reference_mode:'none'})).toEqual({result_type:'numeric',reference_mode:'none',plan:'input'});
 expect(definitionForSave({result_type:'numeric',reference_mode:'interval',lowerlimit:0,upperlimit:0}).plan).toBe('limits');
 expect(definitionForSave({result_type:'text',reference_mode:'text'}).plan).toBe('textReference');
 expect(definitionForSave({result_type:'numeric',reference_mode:'comparison',textReference:'<=0'}).plan).toBe('greaterLessEqualTo');
});
it('rejects unsupported type/reference combinations and inverted limits',()=>{
 for(const row of [{result_type:'text',reference_mode:'interval'},{result_type:'numeric',reference_mode:'interval',lowerlimit:10,upperlimit:0},{result_type:'numeric',reference_mode:'comparison',textReference:'abc'}])expect(()=>definitionForSave(row)).toThrow();
});
it('validates only explicitly typed numeric results; legacy text is untouched',()=>{
 for(const value of ['0','-0.5','1e3',''])expect(()=>validateTypedResult({result_type:'numeric'},value)).not.toThrow();
 expect(()=>validateTypedResult({result_type:'numeric'},'abc')).toThrow();
 expect(()=>validateTypedResult({result_type:null},'legacy text')).not.toThrow();
});

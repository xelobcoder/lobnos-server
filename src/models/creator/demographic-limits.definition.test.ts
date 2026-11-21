import {expect,it} from 'vitest';
import {applyDemographicLimits} from './demographic-limits';
const rule={plan:'limits',lowerlimit:'0',upperlimit:'10',lowerLimitFemale:'20',upperLimitFemale:'30',lowerLimitChildren:'1',upperLimitChildren:'5'};
it('explicit interval mode ignores unused demographic limits without deleting them',()=>{
 expect(applyDemographicLimits({...rule,reference_mode:'interval'},'female','child')).toMatchObject({lowerlimit:'0',upperlimit:'10',lowerLimitFemale:'20'});
});
it('explicit demographic mode uses child intervals for both sexes while legacy behavior is unchanged',()=>{
 expect(applyDemographicLimits({...rule,reference_mode:'demographic'},'female','child')).toMatchObject({lowerlimit:'1',upperlimit:'5'});
 expect(applyDemographicLimits(rule,'female','child')).toMatchObject({lowerlimit:'20',upperlimit:'30'});
});

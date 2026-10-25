import {describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({connect:vi.fn(),after:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:mocks.connect}));
vi.mock('../../database/appLevelTriggers',()=>({applyClinicianAfterInsert:mocks.after,applyClinicianAfterDelete:vi.fn()}));
vi.mock('../referral/repositories/ReferralCodingRepo',()=>({ReferralCodingRepo:class{create=vi.fn().mockResolvedValue(1)}}));
import Clinician from './clinicianClass';
describe('Adding a practitioner preserves existing credentials',()=>{
 it('never performs a blanket password update',async()=>{const credentials=[{clinicianid:1,password:'original-hash'}];const sql:string[]=[];const trx:any=()=>({select:()=>({where:()=>({first:async()=>({identifier:'C2'})})})});trx.raw=async(query:string,bindings:any[])=>{sql.push(query);if(/^UPDATE clinicianscredentials/i.test(query)&&!query.includes('WHERE'))credentials.forEach(r=>r.password=bindings[0]);return [{insertId:2}]};trx.commit=vi.fn();trx.rollback=vi.fn();mocks.connect.mockResolvedValue({transaction:async()=>trx});mocks.after.mockImplementation(async()=>{credentials.push({clinicianid:2,password:'new-hash'})});const result=await new Clinician().postClinicianBasicInfo({tenantId:1,name:'Dr New',phone:'',email:'',location:'',address:'',occupation:'',organization:null});expect(result).toBe(2);expect(credentials[0].password).toBe('original-hash');expect(credentials[1].clinicianid).toBe(2);expect(sql.some(s=>/^UPDATE clinicianscredentials/i.test(s))).toBe(false);expect(mocks.after).toHaveBeenCalledWith(1,trx,{clinicianid:2,identifier:'C2'});});
});

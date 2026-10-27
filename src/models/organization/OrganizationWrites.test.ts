import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({connection:vi.fn(),query:vi.fn(),after:vi.fn(),referral:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:mocks.connection}));
vi.mock('../../database/appLevelTriggers',()=>({applyOrganizationAfterInsert:mocks.after}));
vi.mock('../../hooks/helper',()=>({promisifyQuery:mocks.query,rowAffected:(r:any)=>r?.affectedRows>0,paginationQuery:vi.fn()}));
vi.mock('../referral/repositories/ReferralCodingRepo',()=>({ReferralCodingRepo:class{create=mocks.referral}}));
vi.mock('../../database/TiifuWorkingClass',()=>({TiifuWorkingClass:{isNumberPhoneNumber:()=>true,isEmailValidEmail:()=>true}}));
import Organization from './organization';
import {QuickReferralEntityService} from '../referral/QuickReferralEntityService';
function fixture(){
 let rows:any[]=[{id:1,name:'Existing',email:'office@example.test',mobile:'0201234567',location:'Accra',gpsmapping:'GA-01'}];
 const original=structuredClone(rows);const trx:any=(table:string)=>{let match=(r:any)=>true;const q:any={where:(criteria:any)=>{match=r=>Object.entries(criteria).every(([k,v])=>String(r[k])===String(v));return q},forUpdate:()=>q,select:()=>q,whereRaw:(_:string,values:any[])=>{match=r=>String(r.name).toLowerCase()===values[0];return q},first:async()=>table==='organization_directory_lock'?{id:1}:rows.find(match),insert:async(row:any)=>{rows.push({id:2,...row});return [2]},update:async(data:any)=>{rows=rows.map(r=>match(r)?{...r,...data}:r);return 1},then:(resolve:any)=>Promise.resolve(table==='organization'?rows.filter(match):[]).then(resolve)};return q};
 trx.raw=async(_:string,values:any[])=>{rows.push({id:2,name:values[0],mobile:values[3],email:values[6]});return [{insertId:2}]};trx.commit=vi.fn();trx.rollback=vi.fn(async()=>{rows=structuredClone(original)});const db:any=()=>{};db.transaction=async(callback?:any)=>callback?callback(trx):trx;mocks.connection.mockResolvedValue(db);mocks.query.mockResolvedValue([{count:0}]);return{rows:()=>rows,trx};
}
describe('every organization write path uses identity checks',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it.each([{email:' OFFICE@EXAMPLE.TEST ',mobile:'0201111111'},{email:'new@example.test',mobile:'+233201234567'}])('blocks normal creation with an existing email or number',async identity=>{const f=fixture();await expect(new Organization(null).createAorganization(1,{name:'New',...identity} as any)).rejects.toThrow('Another organization');expect(f.rows()).toHaveLength(1);expect(mocks.after).not.toHaveBeenCalled()});
 it('updates its own details but refuses contacts owned by another organization',async()=>{const f=fixture();await expect(new Organization(1).updateOrganizationBasic(1,{id:1,email:'OFFICE@example.test',location:'Kumasi'})).resolves.toBe(true);expect(f.rows()[0]).toMatchObject({location:'Kumasi',email:'office@example.test',gpsmapping:'GA-01'});f.rows().push({id:3,name:'Other',email:'other@example.test',mobile:'0209999999'});await expect(new Organization(1).updateOrganizationBasic(1,{id:1,email:'other@example.test'})).rejects.toThrow('email')});
 it('reports duplicate import rows without inserting or creating referral side effects',async()=>{const f=fixture();const results=await new Organization(null).insertOrganizationsBulk(1,[{name:'New',email:'office@example.test',mobile:'0201111111'} as any]);expect(String(results[0])).toContain('email');expect(f.rows()).toHaveLength(1);expect(mocks.after).not.toHaveBeenCalled()});
 it('blocks duplicates in quick-add while keeping repeated same-name selections idempotent',async()=>{const f=fixture();const service=new QuickReferralEntityService(1);await expect(service.createOrganization({name:'New',email:'office@example.test',phone:null} as any)).rejects.toThrow('email');expect(await service.createOrganization({name:'Existing',email:null,phone:null} as any)).toMatchObject({id:1,created:false});expect(f.rows()).toHaveLength(1)});
 it('keeps normal creation and referral side effects for a unique organization',async()=>{const f=fixture();expect(await new Organization(null).createAorganization(1,{name:'New',email:' NEW@example.test ',mobile:'0201111111'} as any)).toBe(true);expect(f.rows()[1]).toMatchObject({email:'new@example.test',mobile:'0201111111'});expect(mocks.after).toHaveBeenCalledWith(f.trx,2);expect(mocks.referral).toHaveBeenCalled()});
});

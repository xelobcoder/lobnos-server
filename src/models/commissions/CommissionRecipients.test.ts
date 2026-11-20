import {afterEach,beforeEach,expect,it} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {commissionRecipients} from './CommissionRecipients';
let fixture:ReturnType<typeof accountingSqlDatabase>;
beforeEach(async()=>{fixture=accountingSqlDatabase();fixture.native.exec('CREATE TABLE clinicianbasicinfo(id INTEGER PRIMARY KEY,name TEXT); CREATE TABLE organization(id INTEGER PRIMARY KEY,name TEXT)');for(const table of ['clinicianbasicinfo','organization'])await fixture.db(table).insert(Array.from({length:61},(_,index)=>({id:index+1,name:`Recipient ${String(index+1).padStart(3,'0')}`})))});
afterEach(()=>fixture.db.destroy());
it.each(['clinician','organization'])('pages and searches all %s recipients beyond the first page',async type=>{
 const first=await commissionRecipients(fixture.db,{type,page:1,pageSize:25});
 const third=await commissionRecipients(fixture.db,{type,page:3,pageSize:25});
 expect(first.total).toBe(61);expect(first.rows).toHaveLength(25);expect(third.rows).toHaveLength(11);expect(third.rows[10].id).toBe(61);
 const found=await commissionRecipients(fixture.db,{type,search:'061'});expect(found.rows.map((r:any)=>r.id)).toEqual([61]);
});
it.each([{type:'roles'},{type:'clinician',page:0},{type:'clinician',pageSize:101}])('rejects invalid recipient queries %j',async query=>{await expect(commissionRecipients(fixture.db,query)).rejects.toMatchObject({statusCode:400})});

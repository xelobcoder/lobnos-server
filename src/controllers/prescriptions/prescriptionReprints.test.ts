import {describe,it,expect,vi} from 'vitest';
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
import KnexConnection from '../../database/KnexConnections';
import {PrescriptionController} from './PrescriptionController';
import {transactionalDatabase} from '../../testSupport/transactionalDatabase';
function fixture(referred=true){
 const f=transactionalDatabase({new_patients:[{patientid:4,firstname:'Ama',middlename:'Akua',lastname:'Mensah'}],companyprofile:[{name:'Example Pharmacy',phonenumber:'0200000000',email:'pharmacy@example.test',address:'Accra'}],prescriptions:[{id:'rx',patient_id:4,clinician_id:2,status:'fulfilled'}],prescription_items:[{id:'referred',prescription_id:'rx',status:referred?'referred':'pending',drug_name_snapshot:'Medicine A',quantity_ordered:10,quantity_dispensed:3,dose:'500 mg',frequency:'Twice daily',duration:'5 days',route:'Oral',updated_at:'2026-10-24T15:31:22Z',created_at:'2026-10-24T15:00:00Z'},{id:'dispensed',prescription_id:'rx',status:'dispensed',drug_name_snapshot:'Medicine B',quantity_ordered:2,quantity_dispensed:2}]});
 vi.mocked(KnexConnection).mockResolvedValue(f.db as any);
 const response:any={status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis()};
 return {...f,response,request:{params:{id:'rx'},authUser:{tenantId:8}} as any};
}
describe('saved referral reprints',()=>{
 it('returns only previously referred medicines with the saved date and no mutations',async()=>{
  const f=fixture(),before=structuredClone(f.rows('prescription_items'));
  await f.db.transaction(async(trx:any)=>{vi.mocked(KnexConnection).mockResolvedValue(trx);await PrescriptionController.getReferralSlip(f.request,f.response);});
  expect(KnexConnection).toHaveBeenCalledWith(8);
  expect(f.response.json).toHaveBeenCalledWith({success:true,data:expect.objectContaining({patientName:'Ama Akua Mensah',company:expect.objectContaining({name:'Example Pharmacy',phonenumber:'0200000000'}),patientId:4,referredAt:'2026-10-24T15:31:22Z',items:[expect.objectContaining({drugName:'Medicine A',quantityRemaining:7})]})});
  expect(f.rows('prescription_items')).toEqual(before);
  expect(f.rows('prescriptions')[0].status).toBe('fulfilled');
 });
 it('does not create a referral when none exists',async()=>{
  const f=fixture(false);
  await f.db.transaction(async(trx:any)=>{vi.mocked(KnexConnection).mockResolvedValue(trx);await PrescriptionController.getReferralSlip(f.request,f.response);});
  expect(f.response.status).toHaveBeenCalledWith(404);
  expect(f.rows('prescription_items')[0].status).toBe('pending');
 });
});

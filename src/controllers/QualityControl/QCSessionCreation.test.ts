import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({connection:vi.fn(),insert:vi.fn(),material:{id:'8510f107-4ea8-4f66-abdb-e6e110a4b914',deviceId:'device-1'} as any}));
vi.mock('../../database/KnexConnections',()=>({default:state.connection}));
import {QCReadingsController} from './QCReadingsController';
const actor={employeeid:7,branch:4,tenantId:3};
function response(){return {status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis()} as any;}
beforeEach(()=>{vi.clearAllMocks();state.material={id:'8510f107-4ea8-4f66-abdb-e6e110a4b914',deviceId:'device-1'};state.insert.mockImplementation(async data=>{if(data.updatedby==null)throw Error('updatedby is required');return [0];});state.connection.mockResolvedValue((table:string)=>{const query:any={where:()=>query,first:async()=>state.material,insert:state.insert};return query;});});
describe('QC session creation',()=>{
 it('sets required audit fields from the signed-in operator and accepts UUID insert result zero',async()=>{
  const res=response();await new QCReadingsController().createSession({authUser:actor,query:{tenantId:'99'},body:{controlMaterialId:state.material.id,createdby:1,updatedby:1}} as any,res);
  expect(state.connection.mock.calls.every(call=>call[0]===3)).toBe(true);
  expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({id:expect.any(String),controlMaterialId:state.material.id,createdby:7,updatedby:7,branchid:4,device_id:'device-1'}));
  expect(res.status).toHaveBeenCalledWith(201);expect(res.json).toHaveBeenCalledWith({status:true});
 });
 it('rejects inactive or missing control materials before inserting',async()=>{
  state.material=undefined;const res=response();await new QCReadingsController().createSession({authUser:actor,body:{controlMaterialId:'8510f107-4ea8-4f66-abdb-e6e110a4b914'}} as any,res);expect(res.status).toHaveBeenCalledWith(400);expect(state.insert).not.toHaveBeenCalled();
 });
 it('requires an authenticated operator and assigned branch',async()=>{
  for(const authUser of [undefined,{...actor,branch:null}]){const res=response();await new QCReadingsController().createSession({authUser,body:{controlMaterialId:'8510f107-4ea8-4f66-abdb-e6e110a4b914'}} as any,res);expect(res.status).toHaveBeenCalledWith(authUser?403:401);}
  expect(state.insert).not.toHaveBeenCalled();
 });
});

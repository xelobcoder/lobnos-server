import {describe, expect, it, vi} from 'vitest';

const mocks=vi.hoisted(()=>({connection:vi.fn(async()=>({})),construct:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:mocks.connection}));
vi.mock('../../models/pharmacy/PharmacyManagement',()=>({
     PharmacyManagement:class {
          constructor(db:unknown,branch:number,actor:number,role:string){mocks.construct(db,branch,actor,role);}
     },
}));
import {pharmacyOperation} from './PharmacyManagementController';
import type {Request,Response} from 'express';

describe('pharmacy management authenticated role',()=>{
     it('passes server-authenticated authority instead of body role into the service',async()=>{
          const request={authUser:{tenantId:2,branch:3,employeeid:4,role:'pharmacy_manager'},body:{role:'admin',adminSelfReview:true}} as unknown as Request;
          const json=vi.fn(),response={json} as unknown as Response;
          await pharmacyOperation(async()=>({reviewed:true}))(request,response);
          expect(mocks.connection).toHaveBeenCalledWith(2);
          expect(mocks.construct).toHaveBeenCalledWith({},3,4,'pharmacy_manager');
          expect(json).toHaveBeenCalledWith({success:true,data:{reviewed:true}});
     });
});

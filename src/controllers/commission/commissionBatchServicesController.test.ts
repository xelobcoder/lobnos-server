import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({create:vi.fn(),eligible:vi.fn(),branch:vi.fn()}));
vi.mock('../../models/commissions/CommissionBatchPaymentServicesRepo',()=>({CommissionBatchPaymentServicesRepo:class{getUnbatchedServicesFromList=state.eligible}}));
vi.mock('../../models/commissions/CommissionBatchPaymentsRepo',()=>({CommissionBatchPaymentsRepo:class{createBatchPaymentWithServices=state.create}}));
vi.mock('../../middleware/authority',()=>({getAuthUser:(req:any)=>req.authUser}));
vi.mock('../../middleware/commissionAuthority',()=>({assertCommissionServiceBranch:state.branch}));
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
import { CommissionBatchServicesController } from './commissionBatchServicesController';
const actor={employeeid:7,branch:4,tenantId:3,role:'admin'};
const payload=()=>({startDate:'2026-01-01',endDate:'2026-10-26',recipientid:'2',recipient_type:'organization',employeeid:999,branchid:999,services:[1,2,3],commissionDue:56.5,amountPaid:20,paymentMethod:1,settlementMode:'partial'});
const response=()=>({status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis(),send:vi.fn().mockReturnThis()}) as any;
beforeEach(()=>{vi.clearAllMocks();state.eligible.mockResolvedValue([1,2,3]);state.create.mockResolvedValue({batchPaymentId:11,expenseId:12,requiresApproval:true,outstanding:56.5,waived:0});state.branch.mockResolvedValue(undefined)});
describe('commission batch request recipient contract',()=>{
 it.each(['organization','clinician'])('normalizes a route-derived %s recipient and preserves signed identity and partial approval',async recipient_type=>{const res=response();await new CommissionBatchServicesController(3).processServiceBatching({authUser:actor,body:{...payload(),recipient_type}} as any,res);expect(state.create).toHaveBeenCalledWith(expect.objectContaining({recipientId:2,recipientType:recipient_type,employeeid:7,branchid:4,actor,commissionDue:56.5,amountPaid:20,settlementMode:'partial',services:[1,2,3],startDate:new Date('2026-01-01T00:00:00Z'),endDate:new Date('2026-10-26T00:00:00Z')}));expect(state.branch).toHaveBeenCalledTimes(3);expect(res.send).toHaveBeenCalledWith(expect.objectContaining({status:true,data:expect.objectContaining({requiresApproval:true,expenseId:12})}))});
 it('continues accepting numeric IDs and legacy day/month/year dates',async()=>{const res=response();await new CommissionBatchServicesController(3).processServiceBatching({authUser:actor,body:{...payload(),recipientid:2,startDate:'01/01/2026',endDate:'26/10/2026'}} as any,res);expect(state.create).toHaveBeenCalledWith(expect.objectContaining({recipientId:2,startDate:new Date('2026-01-01T00:00:00Z')}))});
 it.each(['2oops','2.1','-2','',0,2.5,'9007199254740993',null])('rejects invalid recipient %s before processing services',async recipientid=>{const res=response();await new CommissionBatchServicesController(3).processServiceBatching({authUser:actor,body:{...payload(),recipientid}} as any,res);expect(res.status).toHaveBeenCalledWith(400);expect(state.create).not.toHaveBeenCalled();expect(state.eligible).not.toHaveBeenCalled()});
 it('rejects an invalid date without creating an expense request',async()=>{const res=response();await new CommissionBatchServicesController(3).processServiceBatching({authUser:actor,body:{...payload(),endDate:'2026-02-30'}} as any,res);expect(res.status).toHaveBeenCalledWith(400);expect(state.create).not.toHaveBeenCalled()});
 it('keeps branch checks authoritative',async()=>{state.branch.mockRejectedValue(Error('Outside branch'));const res=response();await new CommissionBatchServicesController(3).processServiceBatching({authUser:actor,body:payload()} as any,res);expect(state.create).not.toHaveBeenCalled()});
});

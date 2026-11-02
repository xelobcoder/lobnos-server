import { describe,expect,it,vi } from 'vitest';
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
import { pharmacyAccountingAccess, pharmacyAnalyticsAccess } from './PharmacyAnalyticsController';
describe('pharmacy analytics permission',()=>{
     it.each(['inventory','expiry','procurement','movements'])('allows a storekeeper to view %s',report=>{
          const next=vi.fn();pharmacyAnalyticsAccess({authUser:{role:'pharmacy_storekeeper'},query:{report}} as any,{} as any,next);expect(next).toHaveBeenCalled();
     });
     it.each(['sales','suppliers','overview'])('denies a storekeeper report %s',report=>{
          const next=vi.fn(),res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};pharmacyAnalyticsAccess({authUser:{role:'pharmacy_storekeeper'},query:{report}} as any,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(403);
     });
     it.each(['finance','profit_loss','balance_sheet','cash_flow','trial_balance','transactions'])('rejects accounting report %s from the analytics API',report=>{
          const next=vi.fn(),res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};pharmacyAnalyticsAccess({authUser:{role:'pharmacy_accountant'},query:{report}} as any,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(400);
     });
});
describe('pharmacy accounting permission',()=>{
     it.each(['admin','pharmacy_manager','pharmacy_accountant'])('allows %s to access accounting reports',role=>{
          const next=vi.fn();pharmacyAccountingAccess({authUser:{role},query:{report:'profit_loss'}} as any,{} as any,next);expect(next).toHaveBeenCalled();
     });
     it.each(['pharmacy_storekeeper','pharmacist','pharmacy_cashier'])('denies %s access to accounting reports',role=>{
          const next=vi.fn(),res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};pharmacyAccountingAccess({authUser:{role},query:{report:'profit_loss'}} as any,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(403);
     });
     it('rejects non-accounting reports',()=>{
          const next=vi.fn(),res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};pharmacyAccountingAccess({authUser:{role:'pharmacy_accountant'},query:{report:'inventory'}} as any,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(400);
     });
});

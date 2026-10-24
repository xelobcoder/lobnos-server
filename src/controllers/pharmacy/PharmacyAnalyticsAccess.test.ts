import { describe,expect,it,vi } from 'vitest';
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
import { pharmacyAnalyticsAccess } from './PharmacyAnalyticsController';
describe('pharmacy analytics permission',()=>{
     it.each(['inventory','expiry','procurement','movements'])('allows a storekeeper to view %s',report=>{
          const next=vi.fn();pharmacyAnalyticsAccess({authUser:{role:'pharmacy_storekeeper'},query:{report}} as any,{} as any,next);expect(next).toHaveBeenCalled();
     });
     it.each(['sales','finance','suppliers','overview'])('denies a storekeeper financial report %s',report=>{
          const next=vi.fn(),res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};pharmacyAnalyticsAccess({authUser:{role:'pharmacy_storekeeper'},query:{report}} as any,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(403);
     });
});

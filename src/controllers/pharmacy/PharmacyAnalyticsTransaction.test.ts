import { describe,expect,it,vi } from 'vitest';
import knex from 'knex';
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
import KnexConnection from '../../database/KnexConnections';
import { PharmacyAnalytics } from '../../models/pharmacy/PharmacyAnalytics';
import { PharmacyAnalyticsController } from './PharmacyAnalyticsController';

describe('pharmacy analytics MySQL transaction',()=>{
     it('generates valid isolation setup instead of combining incompatible Knex options',async()=>{
          const db=knex({client:'mysql2'}),sql:string[]=[];
          vi.spyOn(db.client,'acquireConnection').mockResolvedValue({query:(query:any,_bindings:any,callback:any)=>{sql.push(query.sql);callback(null,[],[]);}} as any);
          vi.spyOn(db.client,'releaseConnection').mockResolvedValue(undefined);
          vi.mocked(KnexConnection).mockResolvedValue(db);
          const report=vi.spyOn(PharmacyAnalytics.prototype,'report').mockResolvedValue({summary:{},rows:[]} as any);
          const req:any={authUser:{tenantId:1,employeeid:3,branch:2,role:'admin'},query:{report:'movements',search:'NON'}};
          const res:any={json:vi.fn(),status:vi.fn().mockReturnThis()};
          try {
               await PharmacyAnalyticsController.report(req,res);
               expect(res.json.mock.calls[0]?.[0]).toEqual({success:true,data:{summary:{},rows:[]}});
               expect(sql).toEqual(['SET TRANSACTION ISOLATION LEVEL repeatable read;','BEGIN;','COMMIT;']);
               expect(report).toHaveBeenCalledWith(req.query);
               expect(res.json).toHaveBeenCalledWith({success:true,data:{summary:{},rows:[]}});
          } finally {report.mockRestore();await db.destroy();}
     });
});

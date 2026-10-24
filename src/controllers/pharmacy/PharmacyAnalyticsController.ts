import { Request, Response, NextFunction } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { PharmacyAnalytics } from '../../models/pharmacy/PharmacyAnalytics';
import { branchOf, roleOf, tenantOf } from './pharmacyContext';
import { roleAllowed } from '../../middleware/roles';
const canFinance=(req:Request)=>roleAllowed(roleOf(req),['admin','pharmacy_manager','pharmacy_accountant']);
export function pharmacyAnalyticsAccess(req:Request,res:Response,next:NextFunction){
     const stockReport=['inventory','expiry','procurement','movements'].includes(String(req.query.report));
     if(canFinance(req)||(stockReport&&roleAllowed(roleOf(req),['pharmacy_storekeeper'])))return next();
     return res.status(403).json({success:false,error:{code:'FORBIDDEN',message:'Pharmacy reporting permission is required'}});
}
export class PharmacyAnalyticsController {
     static async report(req:Request,res:Response){
          try{
               // Knex's MySQL dialect joins isolationLevel and readOnly without the
               // comma required by MySQL. Keep the consistent snapshot using the
               // isolation option alone; analytics executes SELECT queries only.
               const db=await KnexConnection(tenantOf(req)),data=await db.transaction(trx=>new PharmacyAnalytics(trx,branchOf(req)!,req.query.all==='true').report(req.query),{isolationLevel:'repeatable read'});
               if(!canFinance(req))data.summary={stockValue:data.summary.stockValue,medicines:data.summary.medicines,reorderItems:data.summary.reorderItems,outOfStock:data.summary.outOfStock} as any;
               res.json({success:true,data});
          }catch(error:any){res.status(400).json({success:false,error:{code:'PHARMACY_REPORT_REJECTED',message:error.message}});}
     }
}

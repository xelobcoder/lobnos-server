import { Request, Response, NextFunction } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { PharmacyAnalytics, PHARMACY_ACCOUNTING_REPORTS, PHARMACY_OPERATIONAL_REPORTS } from '../../models/pharmacy/PharmacyAnalytics';
import { branchOf, roleOf, tenantOf } from './pharmacyContext';
import { roleAllowed } from '../../middleware/roles';
import {PharmacyItemAnalytics} from '../../models/pharmacy/PharmacyItemAnalytics';
const canFinance=(req:Request)=>roleAllowed(roleOf(req),['admin','pharmacy_manager','pharmacy_accountant']);
export function pharmacyAnalyticsAccess(req:Request,res:Response,next:NextFunction){
     const report=String(req.query.report||'overview');
     if(!PHARMACY_OPERATIONAL_REPORTS.includes(report as typeof PHARMACY_OPERATIONAL_REPORTS[number]))return res.status(400).json({success:false,error:{code:'PHARMACY_REPORT_REJECTED',message:'Financial statements are available in Pharmacy Accounting'}});
     const stockReport=['inventory','expiry','procurement','movements'].includes(report);
     if(canFinance(req)||(stockReport&&roleAllowed(roleOf(req),['pharmacy_storekeeper'])))return next();
     return res.status(403).json({success:false,error:{code:'FORBIDDEN',message:'Pharmacy reporting permission is required'}});
}
export function pharmacyAccountingAccess(req:Request,res:Response,next:NextFunction){
     if(!canFinance(req))return res.status(403).json({success:false,error:{code:'FORBIDDEN',message:'Pharmacy accounting permission is required'}});
     const report=String(req.query.report||'profit_loss');
     if(!PHARMACY_ACCOUNTING_REPORTS.includes(report as typeof PHARMACY_ACCOUNTING_REPORTS[number]))return res.status(400).json({success:false,error:{code:'PHARMACY_REPORT_REJECTED',message:'Select a Pharmacy Accounting report'}});
     return next();
}
export class PharmacyAnalyticsController {
     static async item(req:Request,res:Response){
          if(!roleAllowed(roleOf(req),['admin','pharmacy_manager','pharmacy_accountant','pharmacy_storekeeper']))return res.status(403).json({success:false,error:{code:'FORBIDDEN',message:'Pharmacy reporting permission is required'}});
          try{
               const db=await KnexConnection(tenantOf(req));
               const data=await db.transaction(trx=>new PharmacyItemAnalytics(trx,branchOf(req)!).report(String(req.params.itemId),String(req.params.section||'summary'),req.query),{isolationLevel:'repeatable read'});
               res.json({success:true,data});
          }catch(error:any){res.status(400).json({success:false,error:{code:'PHARMACY_REPORT_REJECTED',message:error.message}});}
     }
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
     static async accountingReport(req:Request,res:Response){
          try{
               const db=await KnexConnection(tenantOf(req)),query={...req.query,report:req.query.report||'profit_loss'};
               const data=await db.transaction(trx=>new PharmacyAnalytics(trx,branchOf(req)!,req.query.all==='true').report(query),{isolationLevel:'repeatable read'});
               res.json({success:true,data});
          }catch(error:any){res.status(400).json({success:false,error:{code:'PHARMACY_REPORT_REJECTED',message:error.message}});}
     }
}

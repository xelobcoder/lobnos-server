import {Request,Response,NextFunction} from 'express';
import KnexConnection from '../../database/KnexConnections';
import {getAuthUser} from '../../middleware/authority';
import {roleAllowed} from '../../middleware/roles';
import {PharmacyStockWorkflows} from '../../models/pharmacy/PharmacyStockWorkflows';
import {PharmacyEnterpriseManagement} from '../../models/pharmacy/PharmacyEnterpriseManagement';
import {PharmacyClinical} from '../../models/pharmacy/PharmacyClinical';
import {PharmacyClaims} from '../../models/pharmacy/PharmacyClaims';
import {PharmacyCustomerAccounts} from '../../models/pharmacy/PharmacySettlement';
import {PharmacyProcurement} from '../../models/pharmacy/PharmacyProcurement';
import {branchOf,tenantOf,roleOf} from './pharmacyContext';
type Services={stock:PharmacyStockWorkflows;management:PharmacyEnterpriseManagement;clinical:PharmacyClinical;claims:PharmacyClaims;accounts:PharmacyCustomerAccounts;procurement:PharmacyProcurement};
export const enterprise=(work:(services:Services,req:Request)=>Promise<any>)=>async(req:Request,res:Response)=>{
     try{const db=await KnexConnection(tenantOf(req)),actor=getAuthUser(req)!;const services={stock:new PharmacyStockWorkflows(db,actor),management:new PharmacyEnterpriseManagement(db,actor),clinical:new PharmacyClinical(db,actor),claims:new PharmacyClaims(db,actor),accounts:new PharmacyCustomerAccounts(db,actor),procurement:new PharmacyProcurement(db,actor)};res.json({success:true,data:await work(services,req)});}
     catch(error:any){const uncertain=typeof error.code==='string'&&/^(ER_|ECONN|ETIMEDOUT|PROTOCOL_)/.test(error.code);res.status(uncertain?503:400).json({success:false,error:{code:uncertain?'PHARMACY_OPERATION_UNCONFIRMED':'PHARMACY_OPERATION_REJECTED',message:uncertain?'The operation could not be confirmed. Retry the original request.':error.message}});}
};
export function pharmacyClinicalAccess(req:Request,res:Response,next:NextFunction){if(roleAllowed(roleOf(req),['admin','pharmacy_manager','pharmacist','pharmacy_dispensary_officer']))return next();return res.status(403).json({success:false,error:{code:'FORBIDDEN',message:'Pharmacist review authority is required'}});}
export async function enterpriseSetup(req:Request,res:Response){try{
     const db=await KnexConnection(tenantOf(req)),branch=branchOf(req);const [items,branches,suppliers,receipts]=await Promise.all([db('pharmacy_inventory_items').where({branchid:branch}).orderBy('name').limit(1000),db('branch').select('branchid','name').orderBy('name'),db('pharmacy_suppliers').where({branchid:branch,is_active:true}).orderBy('name'),db('pharmacy_documents').where({branchid:branch,kind:'receipt'}).orderBy('created_at','desc').limit(100)]);
     res.json({success:true,data:{items,branches,suppliers,receipts:receipts.map(row=>({...row,details:typeof row.details==='string'?JSON.parse(row.details):row.details}))}});
}catch(error:any){res.status(400).json({success:false,error:{message:error.message}});}}

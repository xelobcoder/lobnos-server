import { Request,Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { StaffAccessService } from '../../models/auth/StaffAccessService';
import AuthenticationRepository from '../../models/settings/users/AuthenticationRepository';

export const staffAccessOperation=(operation:(service:StaffAccessService,req:Request)=>Promise<any>)=>async(req:Request,res:Response)=>{
     res.setHeader('Cache-Control','private, no-store');
     const actor=getAuthUser(req);
     if(!actor||['patient','clinician'].includes(actor.role))return res.status(403).json({success:false,error:{message:'A staff account is required'}});
     try{
          const service=new StaffAccessService(await KnexConnection(actor.tenantId),actor);
          res.json({success:true,data:await operation(service,req)});
     }catch(error:any){res.status(400).json({success:false,error:{message:error.code?'Unable to save staff access. Reload before retrying.':error.message}});}
};

export const switchStaffRole=staffAccessOperation(async(service,req)=>{
     const claims=(req as any).staffClaims;
     if(!claims?.sid||claims.clientType==='device-manager')throw Error('Sign in through the staff application to switch roles');
     // Mint before committing the projection; signing failures must not strand the old session.
     let accessToken='';
     const row=await service.switchRole(req.body,claims,async(row:any)=>{
          const {iat,exp,nbf,role,...identity}=claims;
          accessToken=await new AuthenticationRepository(getAuthUser(req)!.tenantId).generateAccessToken(row.email,{...identity,arv:Number(row.access_revision||0)});
     });
     return {accessToken,role:row.role,branchid:row.branch};
});

export const refreshStaffRoleSession=staffAccessOperation(async(service,req)=>{
     const claims=(req as any).staffClaims;
     if(!claims?.sid||claims.clientType==='device-manager')throw Error('Sign in through the staff application to restore your session');
     let accessToken='';
     const row=await service.refreshRoleSession(claims,async(row:any)=>{
          const {iat,exp,nbf,role,...identity}=claims;
          const remaining=Math.min(10800,Math.floor(Number(exp)-Date.now()/1000));
          if(!Number.isFinite(remaining)||remaining<=0)throw Error('Your session has expired. Sign in again.');
          accessToken=await new AuthenticationRepository(getAuthUser(req)!.tenantId).generateAccessToken(row.email,{...identity,arv:Number(row.access_revision||0)},remaining);
     });
     return {accessToken,role:row.role,branchid:row.branch};
});

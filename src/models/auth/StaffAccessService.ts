import { requireStrongPassword } from './PasswordPolicy';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { isSuperAdminRole, roleAllowed } from '../../middleware/roles';
import { AuthUser } from '../../middleware/authority';
import { staffAccessVersionMatches } from './StaffAccessSchema';
import {formatLoginUsername} from './TenantLoginDirectory';
import {revokePasswordSessions} from './passwordSessions';

export const PHARMACY_STAFF_ROLES=['pharmacy_manager','pharmacy_accountant','pharmacy_cashier','pharmacy_storekeeper','pharmacy_dispensary_officer','pharmacist','pharmacy_doctor','pharmacy_nurse'];
export const STAFF_ROLES=['admin','manager','scientist','sonographer','head_of_laboratory','head_of_imaging','phelobotomist','customer service representative','cashier','accountant','storekeeper','marketer','doctor','medical_officer','consultant','nurse',...PHARMACY_STAFF_ROLES];
const owner=(role:string)=>roleAllowed(role,['admin']);
const id=(value:any)=>{if(!Number.isSafeInteger(Number(value))||Number(value)<=0)throw Error('Select a valid employee or location');return Number(value);};
const text=(value:any,label:string,max=100)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error('Enter a valid '+label);return value.trim();};

export class StaffAccessService {
     constructor(private db:any,private actor:AuthUser) {}
     private manage(){if(!owner(this.actor.role)&&!roleAllowed(this.actor.role,['pharmacy_manager']))throw Error('Staff administration permission is required');}
     private allowed(role:string,branch:number){
          this.manage();
          if(!STAFF_ROLES.includes(role))throw Error('Select a supported staff role');
          if(!owner(this.actor.role)&&(!PHARMACY_STAFF_ROLES.includes(role)||role==='pharmacy_manager'||branch!==Number(this.actor.branch)))throw Error('Pharmacy managers may assign operational pharmacy roles only in their own location');
     }
     private async event(trx:any,employeeid:number,action:string,details:any){await trx('staff_access_events').insert({id:randomUUID(),employeeid,performed_by:this.actor.employeeid,action,details:JSON.stringify(details),created_at:new Date()});}
     private async assignments(trx:any,row:any){
          const rows=await trx('staff_role_access').where({employeeid:row.employeeid});
          if(rows.length)return rows;
          // Preserve the existing assignment when introducing multiple roles.
          return [{id:'default',employeeid:row.employeeid,role:row.role,branchid:row.branch,is_default:true}];
     }
     private async manageableEmployee(trx:any,row:any){
          const assignments=await this.assignments(trx,row);
          if(assignments.some((a:any)=>isSuperAdminRole(a.role))&&!isSuperAdminRole(this.actor.role))throw Error('Only a platform administrator may change this account');
          if(owner(this.actor.role))return;
          if(assignments.some((a:any)=>Number(a.branchid)!==Number(this.actor.branch)||!PHARMACY_STAFF_ROLES.includes(a.role)||a.role==='pharmacy_manager'))throw Error('Only an administrator may change this employee’s assignments');
     }
     async mine(){
          const row=await this.db('roles').where({employeeid:this.actor.employeeid}).first();
          if(!row||Number(row.activation)!==1)throw Error('Staff account is not active');
          const branches=await this.db('branch').select('branchid','name');
          return {active:{role:row.role,branchid:row.branch},assignments:(await this.assignments(this.db,row)).map((a:any)=>({...a,branchName:branches.find((b:any)=>Number(b.branchid)===Number(a.branchid))?.name||`Location ${a.branchid}`}))};
     }
     async directory(){
          this.manage();
          const q=this.db('roles').select('employeeid','username','email','role','branch','activation','login_username');
          if(!owner(this.actor.role))q.where({branch:this.actor.branch}).whereIn('role',PHARMACY_STAFF_ROLES);
          const people=await q;
          const assignments=people.length?await this.db('staff_role_access').whereIn('employeeid',people.map((p:any)=>p.employeeid)):[];
          const branches=await this.db('branch').select('branchid','name');
          const directory=people.map((p:any)=>({...p,assignments:assignments.filter((a:any)=>Number(a.employeeid)===Number(p.employeeid)).length?assignments.filter((a:any)=>Number(a.employeeid)===Number(p.employeeid)):[{id:'default',role:p.role,branchid:p.branch,is_default:true}]}));
          return {people:owner(this.actor.role)?directory:directory.filter((p:any)=>p.assignments.every((a:any)=>Number(a.branchid)===Number(this.actor.branch)&&PHARMACY_STAFF_ROLES.includes(a.role)&&a.role!=='pharmacy_manager')),branches:owner(this.actor.role)?branches:branches.filter((b:any)=>Number(b.branchid)===Number(this.actor.branch)),roles:owner(this.actor.role)?STAFF_ROLES:PHARMACY_STAFF_ROLES.filter(r=>r!=='pharmacy_manager')};
     }
     async grant(employeeid:any,input:any){
          const target=id(employeeid),branch=id(input.branchid),role=text(input.role,'role');this.allowed(role,branch);
          return this.db.transaction(async(trx:any)=>{
               const row=await trx('roles').where({employeeid:target}).forUpdate().first();
               if(!row)throw Error('Employee not found');
               await this.manageableEmployee(trx,row);
               if(!owner(this.actor.role)&&(Number(row.branch)!==Number(this.actor.branch)||!PHARMACY_STAFF_ROLES.includes(row.role)||row.role==='pharmacy_manager'))throw Error('Only an administrator may change this employee’s assignments');
               if(!await trx('branch').where({branchid:branch}).first())throw Error('Location not found');
               const existing=await this.assignments(trx,row);
               if(existing[0]?.id==='default'){
                    await trx('staff_role_access').insert({...existing[0],branchid:row.branch??branch,id:randomUUID(),granted_by:this.actor.employeeid});
                    if(row.branch==null)await trx('roles').where({employeeid:target}).update({branch});
               }
               const old=await trx('staff_role_access').where({employeeid:target,role,branchid:branch}).first();
               if(!old){await trx('staff_role_access').insert({id:randomUUID(),employeeid:target,role,branchid:branch,is_default:false,granted_by:this.actor.employeeid});await this.event(trx,target,'role_granted',{role,branchid:branch});}
               return {assigned:true};
          });
     }
     async revoke(employeeid:any,assignmentId:string){
          this.manage();const target=id(employeeid);
          return this.db.transaction(async(trx:any)=>{
               const row=await trx('roles').where({employeeid:target}).forUpdate().first();
               const assignment=await trx('staff_role_access').where({id:assignmentId,employeeid:target}).first();
               if(!row||!assignment)throw Error('Assignment not found');
               await this.manageableEmployee(trx,row);
               this.allowed(assignment.role,Number(assignment.branchid));
               if(!owner(this.actor.role)&&(Number(row.branch)!==Number(this.actor.branch)||!PHARMACY_STAFF_ROLES.includes(row.role)||row.role==='pharmacy_manager'))throw Error('Only an administrator may change this employee’s assignments');
               if(row.role===assignment.role&&Number(row.branch)===Number(assignment.branchid))throw Error('This assignment is in use. Ask the employee to switch to another assigned role before removing it.');
               await trx('staff_role_access').where({id:assignmentId,employeeid:target}).del();
               await this.event(trx,target,'role_revoked',{role:assignment.role,branchid:assignment.branchid});return {removed:true};
          });
     }
     async activation(employeeid:any,input:any){
          this.manage();const target=id(employeeid);
          if(typeof input.active!=='boolean')throw Error('Choose whether this account is active');
          if(target===this.actor.employeeid)throw Error('You cannot deactivate or reactivate your own account');
          return this.db.transaction(async(trx:any)=>{
               const row=await trx('roles').where({employeeid:target}).forUpdate().first();
               if(!row)throw Error('Employee not found');
               await this.manageableEmployee(trx,row);
               if(!owner(this.actor.role)&&(Number(row.branch)!==Number(this.actor.branch)||!PHARMACY_STAFF_ROLES.includes(row.role)||row.role==='pharmacy_manager'))throw Error('Only an administrator may change this employee’s account');
               await trx('roles').where({employeeid:target}).update({activation:input.active?1:0,access_revision:Number(row.access_revision||0)+1});
               await revokePasswordSessions(trx,'staff',target);
               await this.event(trx,target,input.active?'staff_activated':'staff_deactivated',{});return {active:input.active};
          });
     }
     async switchRole(input:any,claims:any,beforeCommit?: (row:any)=>Promise<void>){
          const role=text(input.role,'role'),branch=id(input.branchid);
          return this.db.transaction(async(trx:any)=>{
               const row=await trx('roles').where({employeeid:this.actor.employeeid}).forUpdate().first();
               if(!row||Number(row.activation)!==1||!staffAccessVersionMatches(claims,row))throw Error('Your active role changed. Reload or sign in again.');
               const assigned=await this.assignments(trx,row);
               if(!assigned.some((a:any)=>a.role===role&&Number(a.branchid)===branch))throw Error('This role and location are not assigned to you');
               if(!await trx('branch').where({branchid:branch}).first())throw Error('Location no longer exists');
               if(row.role===role&&Number(row.branch)===branch){await beforeCommit?.(row);return row;}
               if(assigned[0]?.id==='default')throw Error('No additional roles have been assigned');
               const access_revision=Number(row.access_revision||0)+1;
               // Compatibility projection: every existing permission check sees exactly the active role.
               await trx('roles').where({employeeid:row.employeeid}).update({role,branch,access_revision});
               await this.event(trx,row.employeeid,'role_switched',{from:{role:row.role,branchid:row.branch},to:{role,branchid:branch},sessionId:claims.sid});
               await beforeCommit?.({...row,role,branch,access_revision});
               return {...row,role,branch,access_revision};
          });
     }
     async refreshRoleSession(claims:any,beforeCommit:(row:any)=>Promise<void>){
          if(Number(claims.employeeid)!==this.actor.employeeid||!claims.sid||claims.clientType==='device-manager')throw Error('Sign in again to restore your staff session');
          return this.db.transaction(async(trx:any)=>{
               const row=await trx('roles').where({employeeid:this.actor.employeeid}).forUpdate().first();
               if(!row||Number(row.activation)!==1)throw Error('Staff account is not active');
               const assigned=await this.assignments(trx,row);
               if(!assigned.some((a:any)=>a.role===row.role&&Number(a.branchid)===Number(row.branch)))throw Error('Your active role assignment needs administrator review');
               await beforeCommit(row);
               return row;
          });
     }
     async create(input:any,platformId:string){
          const role=text(input.role,'role'),branch=id(input.branchid);this.allowed(role,branch);
          const username=text(input.name,'full name'),email=text(input.email,'email',200).toLowerCase(),mobile=text(input.mobile,'mobile number',10);
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address');
          if(!/^\+?\d{7,10}$/.test(mobile))throw Error('Enter a mobile number of 7–10 digits');
          requireStrongPassword(input.password);
          if(!/^\d{4}$/.test(String(input.pin||'')))throw Error('Enter a four-digit financial PIN');
          const password=await bcrypt.hash(input.password,10),pin_hash=await bcrypt.hash(String(input.pin),10);
          return this.db.transaction(async(trx:any)=>{
               if(!await trx('branch').where({branchid:branch}).first())throw Error('Location not found');
               if(await trx('roles').where({email}).first())throw Error('A staff account already uses this email. Assign another role to that account instead.');
               if(await trx('roles').where({mobile}).first())throw Error('This mobile number is already linked to a staff account. Assign another role to that account instead.');
               const [employeeid]=await trx('roles').insert({username,email,mobile,password,pin:null,pin_hash,role,branch,activation:1,emailAuthenticated:'false',access_revision:0});
               const login_username=formatLoginUsername(platformId,'staff',Number(employeeid));
               await trx('roles').where({employeeid}).update({login_username});
               await trx('staff_role_access').insert({id:randomUUID(),employeeid,role,branchid:branch,is_default:true,granted_by:this.actor.employeeid});
               await this.event(trx,employeeid,'staff_created',{role,branchid:branch});return {employeeid,username,email,loginUsername:login_username};
          });
     }
}

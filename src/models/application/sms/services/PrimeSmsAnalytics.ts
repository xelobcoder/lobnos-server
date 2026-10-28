import KnexConnection from '../../../../database/KnexConnections';
import type { AuthUser } from '../../../../middleware/authority';
import { scopeSmsCampaigns } from '../SmsCampaignService';
export class PrimeSmsAnalytics {
 constructor(private tenantId:number,private actor?:AuthUser){}
 private async base(recipients=false){
  const db=await KnexConnection(this.tenantId);
  let query=recipients?db('primesmsjobrecipients as p').join('primesmsjobs as j','j.jobid','p.jobid'):db('primesmsjobs as j');
  query=query.leftJoin('sms_campaign_dispatch as d','d.jobid','j.jobid').leftJoin('roles as r','r.employeeid','j.createdby');
  return {db,query:this.actor?scopeSmsCampaigns(query,this.actor):query};
 }
 private async counts(column:string,recipients=false){
  const {query}=await this.base(recipients);const rows=await query.select(column).count('* as count').groupBy(column);
  return Object.fromEntries(rows.map((row:any)=>[row[column.split('.').pop()!],Number(row.count)]));
 }
 getJobStatusCounts(){return this.counts('j.status');}
 getRecipientDeliveryCounts(){return this.counts('p.deliverystatus',true);}
 getJobCountsByCategory(){return this.counts('j.category');}
 async getTotals(){const jobs=await this.base(),recipients=await this.base(true);return {totalJobs:Number((await jobs.query.count('* as count').first())?.count||0),totalRecipients:Number((await recipients.query.count('* as count').first())?.count||0)};}
 private async trends(recipients:boolean,days=30,from?:string,to?:string){
  const {db,query}=await this.base(recipients),date=recipients?'COALESCE(p.sentat,j.createdat)':'j.createdat',status=recipients?'p.deliverystatus':'j.status';
  query.select(db.raw(`DATE(${date}) as day`),db.raw(`${status} as status`)).count('* as count');
  if(from&&to&&/^\d{4}-\d{2}-\d{2}$/.test(from)&&/^\d{4}-\d{2}-\d{2}$/.test(to))query.whereRaw(`${date} >= ? AND ${date} < DATE_ADD(?, INTERVAL 1 DAY)`,[from,to]);
  else query.whereRaw(`${date} >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,[Math.min(366,Math.max(1,Number(days)||30))]);
  const rows=await query.groupByRaw(`DATE(${date}), ${status}`).orderBy('day');const result:Record<string,Record<string,number>>={};
  for(const row of rows){const day=row.day instanceof Date?row.day.toISOString().slice(0,10):String(row.day).slice(0,10);(result[day]||={})[row.status]=Number(row.count);}return result;
 }
 getJobTrendsByDay(days=30,from?:string,to?:string){return this.trends(false,days,from,to);}
 getDeliveryTrendsByDay(days=30,from?:string,to?:string){return this.trends(true,days,from,to);}
}

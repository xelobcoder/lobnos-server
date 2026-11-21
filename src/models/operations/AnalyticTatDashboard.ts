import KnexConnection from '../../database/KnexConnections';
export const analyticBenchmarks=['on_time','in_progress','due_soon','overdue','not_started','no_target','data_review'] as const;
export function analyticDashboardQuery(branch:number|null,from?:string,to?:string){
 const params:any[]=[];let scope='';if(branch!=null){scope+=' AND bb.branchid=?';params.push(branch);}if(from){scope+=' AND ta.ascension_date>=?';params.push(from);}if(to){scope+=' AND ta.ascension_date<DATE_ADD(?, INTERVAL 1 DAY)';params.push(to);}
 const routine=`CASE WHEN td.tat>0 THEN CEIL(td.tat * CASE LOWER(COALESCE(td.tatEvaluation,'min')) WHEN 'hour' THEN 60 WHEN 'hours' THEN 60 WHEN 'days' THEN 1440 WHEN 'seconds' THEN 1/60 ELSE 1 END) ELSE NULL END`;
 const target=`CASE COALESCE(work.priority,'routine') WHEN 'stat' THEN COALESCE(tp.lab_stat_tat_minutes,${routine}) WHEN 'urgent' THEN COALESCE(tp.lab_urgent_tat_minutes,${routine}) ELSE ${routine} END`;
 const base=`SELECT ta.id AS ascensionId,ta.billingid AS billingId,ta.ascension_date AS registeredAt,ta.collectionEndDate AS collectedAt,ta.processingStartDate,ta.processingEndDate,ta.resultEntryEnd,ta.testid AS testId,tp.name AS testName,d.department,COALESCE(work.priority,'routine') AS priority,np.fullpatientid AS patientNumber,CONCAT_WS(' ',np.firstname,np.middlename,np.lastname) AS patientName,${target} AS configuredTat,
 EXISTS(SELECT 1 FROM test_results r WHERE r.ascensionid=ta.id) AS hasResults,
 CASE WHEN ta.processingStartDate IS NOT NULL AND (ta.processingEndDate>=ta.processingStartDate OR ta.processingEndDate IS NULL) THEN TIMESTAMPDIFF(MINUTE,ta.processingStartDate,COALESCE(ta.processingEndDate,NOW())) ELSE NULL END AS measuredMinutes,
 TIMESTAMPDIFF(MINUTE,ta.ascension_date,COALESCE(ta.resultEntryEnd,NOW())) AS recordAgeMinutes
 FROM test_ascension ta JOIN dboservices ss ON ss.serviceid=ta.serviceid JOIN billing bb ON bb.billingid=ta.billingid JOIN new_patients np ON np.patientid=bb.patientid JOIN test_panels tp ON tp.id=ta.testid LEFT JOIN testdetails td ON td.testid=tp.id LEFT JOIN lab_work_assignments work ON work.ascensionid=ta.id LEFT JOIN departments d ON d.id=tp.category
 WHERE (ss.isDeleted=0 OR ss.isDeleted IS NULL) AND LOWER(COALESCE(ss.status,'active')) NOT IN ('voided','refunded','cancelled','written-off')${scope}`;
 const query=`SELECT timing.*,CASE WHEN (processingStartDate IS NULL AND (resultEntryEnd IS NOT NULL OR hasResults=1 OR processingEndDate IS NOT NULL)) OR (processingEndDate IS NULL AND (resultEntryEnd IS NOT NULL OR hasResults=1)) OR processingEndDate<processingStartDate OR processingStartDate>NOW() OR processingEndDate=processingStartDate THEN 'data_review'
 WHEN processingStartDate IS NULL THEN 'not_started' WHEN configuredTat IS NULL THEN 'no_target' WHEN measuredMinutes>configuredTat THEN 'overdue' WHEN processingEndDate IS NOT NULL THEN 'on_time' WHEN measuredMinutes>=configuredTat*0.8 THEN 'due_soon' ELSE 'in_progress' END AS benchmark FROM (${base}) timing`;
 return {query,params};
}
export async function analyticDashboard(tenantId:number,branch:number|null,options:{from?:string;to?:string;benchmark?:string;page?:number;count?:number}={}){
 const db=await KnexConnection(tenantId);const {query,params}=analyticDashboardQuery(branch,options.from,options.to);
 if(!options.benchmark){const [rows]=await db.raw(`SELECT benchmark,COUNT(*) AS count FROM (${query}) classified GROUP BY benchmark`,params);return analyticBenchmarks.map(key=>({key,count:Number(rows.find((r:any)=>r.benchmark===key)?.count||0)}));}
 if(!analyticBenchmarks.includes(options.benchmark as any))throw Object.assign(new Error('Invalid analytic benchmark'),{statusCode:400});
 const count=Math.max(1,Math.min(100,Number(options.count)||10)),page=Math.max(1,Number(options.page)||1);
 const [[total]]=await db.raw(`SELECT COUNT(*) AS total FROM (${query}) classified WHERE benchmark=?`,[...params,options.benchmark]);
 const [rows]=await db.raw(`SELECT * FROM (${query}) classified WHERE benchmark=? ORDER BY registeredAt DESC,ascensionId DESC LIMIT ? OFFSET ?`,[...params,options.benchmark,count,(page-1)*count]);
 return {data:rows.map((row:any)=>({...row,analyticMinutes:['data_review','not_started'].includes(row.benchmark)?null:row.measuredMinutes})),total:Number(total.total),page,count};
}

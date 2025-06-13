import KnexConnection from "../../../database/KnexConnections";
import { LeadActivity } from "./dev/types";


export class LeadActivitiesRepo {
     private tenantId: number;
     private connection: any;
 
     constructor(tenantId: number) {
         this.tenantId = tenantId;
         this.connection = KnexConnection(tenantId);
     }
 
     async create(activity: Omit<LeadActivity, 'id'>) {
         try {
             return await this.connection('lead_activities').insert(activity).returning('*');
         } catch (error) {
             console.error('Activity creation error: %d', error);
             throw error;
         }
     }
 
     async findByLeadId(leadId: string) {
         try {
             return await this.connection('lead_activities')
                 .where({ lead_id: leadId })
                 .orderBy('activity_date', 'desc');
         } catch (error) {
             console.error('Activity find error:', error);
             throw error;
         }
     }
 }
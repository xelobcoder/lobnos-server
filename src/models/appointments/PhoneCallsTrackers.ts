import KnexConnection from "../../database/KnexConnections";
import Appointment from "./appointments";

export interface PhoneCallLog {
     id?: number;
     patientid: number;
     appointment_refid?: number;
     call_direction: 'outbound' | 'inbound';
     purpose: string;
     scheduled_at?: string;
     started_at?: string;
     ended_at?: string;
     duration_seconds?: number;
     outcome?: 'answered' | 'no_answer' | 'voicemail' | 'failed' | 'busy' | 'declined' | 'left_message';
     status: 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
     call_reference_id?: string;
     recording_url?: string;
     notes?: string;
     retry_count?: number;
     next_followup_at?: string;
     created_by?: number;
     metadata?: any;
     created_at?: string;
     updated_at?: string;
}
export class PhoneCallsTrackersRepo {
     private tenantId: number;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
     }

     private async getConn() {
          return await KnexConnection(this.tenantId);
     }

     async create(data: PhoneCallLog) {
          const conn = await this.getConn();
          // Only allow fields that exist in the DB table
          const allowedFields = [
               "patientid", "appointment_refid", "call_direction", "purpose", "scheduled_at", "started_at", "ended_at",
               "outcome", "status", "call_reference_id", "recording_url", "notes", "retry_count", "next_followup_at",
               "created_by", "metadata"
          ];
          const filteredData: Record<string, any> = {};
          for (const key of allowedFields) {
               if (data[key as keyof PhoneCallLog] !== undefined) {
                    filteredData[key] = data[key as keyof PhoneCallLog];
               }
          }
          const [id] = await conn("phone_call_logs").insert(filteredData);
          return id;
     }

     async getById(id: number): Promise<PhoneCallLog | null> {
          const conn = await this.getConn();
          const row = await conn("phone_call_logs").where({ id }).first();
          return row || null;
     }

     async update(id: number, data: Partial<PhoneCallLog>) {
          const conn = await this.getConn();
          await conn("phone_call_logs").where({ id }).update(data);
          return await this.getById(id);
     }

     async delete(id: number) {
          const conn = await this.getConn();
          return await conn("phone_call_logs").where({ id }).del();
     }

     async list(filter: Partial<PhoneCallLog> = {}) {
          const conn = await this.getConn();
          return await conn("phone_call_logs").where(filter);
     }

     async listWithPagination(page: number = 1, limit: number = 10, filter: Partial<PhoneCallLog> = {}) {
          const conn = await this.getConn();
          const offset = (page - 1) * limit;

          const [data, totalCount] = await Promise.all([
               conn("phone_call_logs as pcl")
                    .leftJoin("roles as r", "pcl.created_by", "r.employeeid")
                    .select(
                         "pcl.*",
                         "r.username as creator_name",
                         "r.role as creator_role",
                         "r.email as creator_email"
                    )
                    .where(filter)
                    .orderBy("pcl.created_at", "desc")
                    .limit(limit)
                    .offset(offset),
               conn("phone_call_logs")
                    .where(filter)
                    .count("id as count")
                    .first()
          ]);

          return {
               data,
               pagination: {
                    page,
                    limit,
                    total: Number(totalCount?.count) || 0,
                    totalPages: Math.ceil((Number(totalCount?.count) || 0) / limit)
               }
          };
     }

     async getByPatient(patientid: number) {
          const conn = await this.getConn();
          return await conn("phone_call_logs").where({ patientid }).orderBy("created_at", "desc");
     }

     async getByAppointment(appointment_refid: number) {
          const conn = await this.getConn();
          return await conn("phone_call_logs").where({ appointment_refid }).orderBy("created_at", "desc");
     }

     async getRecent(limit: number = 10) {
          const conn = await this.getConn();
          return await conn("phone_call_logs").orderBy("created_at", "desc").limit(limit);
     }

     async getScheduledCalls() {
          const conn = await this.getConn();
          return await conn("phone_call_logs").where({ status: 'scheduled' }).orderBy("scheduled_at", "asc");
     }

     async getMissedCalls(patientid?: number) {
          const conn = await this.getConn();
          let query = conn("phone_call_logs").where({ status: 'missed' });
          if (patientid) query = query.andWhere({ patientid });
          return await query.orderBy("created_at", "desc");
     }

     async getCallsByDirection(direction: 'outbound' | 'inbound', limit: number = 10) {
          const conn = await this.getConn();
          return await conn("phone_call_logs").where({ call_direction: direction }).orderBy("created_at", "desc").limit(limit);
     }

     async getCallsWithFollowupDue() {
          const conn = await this.getConn();
          return await conn("phone_call_logs")
               .whereNotNull("next_followup_at")
               .andWhere("next_followup_at", "<=", conn.raw("CURRENT_TIMESTAMP"))
               .orderBy("next_followup_at", "asc");
     }
}

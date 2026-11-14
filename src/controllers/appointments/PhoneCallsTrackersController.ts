import { Request, response, Response } from "express";
import { PhoneCallsTrackersRepo } from "../../models/appointments/PhoneCallsTrackers";
import { customError } from "../../hooks/helper";
import { SmsService } from "../../models/application/integrations/Arkesel";
import KnexConnection from '../../database/KnexConnections';
import { SHARED_APPOINTMENT_SMS_BODY } from '../../models/appointments/AppointmentSmsContact';
import { getAuthUser } from '../../middleware/authority';
import { SmsCampaignService } from '../../models/application/sms/SmsCampaignService';
import { isSmsActive } from '../../models/application/sms/SmsActivation';



export interface AppointmentSchedule {
     appointmentDetails: AppointmentDetails;
     scheduleDate: string;
     type: "schedule" | "now";
}

export interface AppointmentDetails {
     refid: number;
     patientid: number;
     duration: number;
     status: string;
     purpose: string;
     mobile_number: string;
     appointment_time: string;
}


export class PhoneCallsTrackersController {
     static async getPhoneCallLogsByAppointmentRef(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const appointment_refid = parseInt(req.params.appointment_refid.toString(), 10);
               if (isNaN(appointment_refid)) {
                    return res.status(400).json({ error: "Missing or invalid appointment_refid in params" });
               }
               const repo = new PhoneCallsTrackersRepo(tenantId);
               const logs = await repo.getByAppointment(appointment_refid);
               res.json(logs);
          } catch (error: any) {
               res.status(500).json({ error: error && error?.message ? error.message : "An error occurred" });
          }
     }
     static async createPhoneCallLog(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               // Zod schema for validation
               const phoneCallLogSchema = require("zod").z.object({
                    patientid: require("zod").z.number().int(),
                    appointment_refid: require("zod").z.number().int().optional(),
                    call_direction: require("zod").z.enum(["outbound", "inbound"]),
                    purpose: require("zod").z.string(),
                    scheduled_at: require("zod").z.string().optional(),
                    started_at: require("zod").z.string().optional(),
                    ended_at: require("zod").z.string().optional(),
                    outcome: require("zod").z.enum(["answered", "no_answer", "voicemail", "failed", "busy", "declined", "left_message"]).optional(),
                    status: require("zod").z.enum(["scheduled", "in_progress", "completed", "missed", "cancelled"]),
                    call_reference_id: require("zod").z.string().max(255).optional(),
                    recording_url: require("zod").z.string().max(500).optional(),
                    notes: require("zod").z.string().optional(),
                    retry_count: require("zod").z.number().int().optional(),
                    next_followup_at: require("zod").z.string().optional(),
                    created_by: require("zod").z.number().int().optional(),
               });
               const parseResult = phoneCallLogSchema.safeParse(req.body);
               if (!parseResult.success) {
                    return res.status(400).json({ error: "Invalid phone call log fields", details: parseResult.error.errors });
               }
               const repo = new PhoneCallsTrackersRepo(tenantId);
               const id = await repo.create(parseResult.data);
               res.status(201).json({ status: id ? "success" : "error", id });
          } catch (error: any) {
               res.status(500).json({ error: error && error?.message ? error.message : "An error occurred" });
          }
     }

     static async getPhoneCallLog(req: Request, res: Response) {
          try {
               if (!req.query.tenantId) {
                    return res.status(400).json({ error: "Missing tenantId in query" });
               }
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const id = parseInt(req.params.id.toString(), 10);
               const repo = new PhoneCallsTrackersRepo(tenantId);
               const log = await repo.getById(id);
               if (!log) return res.status(404).json({ error: "Not found" });
               res.json(log);
          } catch (error: any) {
               res.status(500).json({ error: error && error?.message ? error.message : "An error occurred" });
          }
     }

     static async updatePhoneCallLog(req: Request, res: Response) {
          try {
               if (!req.query.tenantId) {
                    return res.status(400).json({ error: "Missing tenantId in query" });
               }
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const id = parseInt(req.params.id.toString(), 10);
               const repo = new PhoneCallsTrackersRepo(tenantId);
               const updated = await repo.update(id, req.body);
               res.json(updated);
          } catch (error: any) {
               res.status(500).json({ error: error && error?.message ? error.message : "An error occurred" });
          }
     }

     static async listPhoneCallLogs(req: Request, res: Response) {
          try {
               if (!req.query.tenantId) {
                    return res.status(400).json({ error: "Missing tenantId in query" });
               }
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const repo = new PhoneCallsTrackersRepo(tenantId);
               const logs = await repo.list(req.query);
               res.json(logs);
          } catch (error: any) {
               res.status(500).json({ error: error && error?.message ? error.message : "An error occurred" });
          }
     }

     static async listPhoneCallLogsWithPagination(req: Request, res: Response) {
          try {
               if (!req.query.tenantId) {
                    return res.status(400).json({ error: "Missing tenantId in query" });
               }
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const page = parseInt(req.query.page as string, 10) || 1;
               const count = parseInt(req.query.count as string, 10) || 10;
               const { page: _, count: __, tenantId: ___, ...filter } = req.query;

               const repo = new PhoneCallsTrackersRepo(tenantId);
               const result = await repo.listWithPagination(page, count, filter);
               res.json(result);
          } catch (error: any) {
               res.status(500).json({ error: error && error?.message ? error.message : "An error occurred" });
          }
     }

     static async sendAppointmentReminders(req: Request<{}, {},
          AppointmentSchedule
          , { tenantId: number | string }>, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string, 10);
               const { appointmentDetails, scheduleDate, type } = req.body;
               const actor = getAuthUser(req as unknown as Request);
               if (!actor || Number(actor.tenantId) !== tenantId) return res.status(401).json({ error: 'Authentication required' });
               if (!(await isSmsActive(tenantId))) return res.status(403).json({ error: 'SMS is not activated for this facility' });
               const refid = Number(appointmentDetails?.refid);
               if (!Number.isSafeInteger(refid) || refid < 1 || !['now', 'schedule'].includes(type)) {
                    return res.status(400).json({ message: 'Select an appointment and a send option.' });
               }
               if (type === 'schedule' && (!scheduleDate || !(new Date(scheduleDate).getTime() > Date.now()))) {
                    return res.status(400).json({ message: 'Choose a future date and time for the reminder.' });
               }
               const db = await KnexConnection(tenantId);
               const appointment = await db('appointments').where({ refid }).first('patientid', 'purpose', 'status');
               if (!appointment?.patientid || ['cancelled', 'completed', 'missed'].includes(String(appointment.status).toLowerCase())) {
                    return res.status(400).json({ message: 'Select an active appointment linked to a patient.' });
               }
               const jobId = await new SmsCampaignService(tenantId, db).enqueueAppointmentReminder(
                    Number(appointment.patientid), appointment.purpose?.trim() || SHARED_APPOINTMENT_SMS_BODY,
                    type === 'schedule' ? scheduleDate : undefined, actor,
               );
               res.json({ status: 'success', jobId, message: type === 'schedule' ? 'Appointment reminder scheduled' : 'Appointment reminder queued' });
               
          } catch (error: any) {
               if (error?.statusCode === 400 || error?.statusCode === 403) {
                    return res.status(error.statusCode).json({ message: error.message });
               }
               res.status(500).json({ message: 'The appointment reminder could not be queued.' });
          }
     }
}

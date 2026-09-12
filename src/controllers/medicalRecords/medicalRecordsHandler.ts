import { Request, Response } from "express";
import PrimeMedicalRecords, { MedicalRecord } from "../../models/MedicalRecords/medicalRecordClass";
import { customError } from "../../hooks/helper";
import { OperationsFailures } from "../../models/operations/types";


export const createAConsultationRecord = async (request: Request<{}, {}, { consultation_notes: string; record_type: string; patientid: number; consulationby: number; associatedTransactionid?: number }, { tenantId: string }>, response: Response) => {
     try {
          const { consultation_notes, record_type, patientid, consulationby, associatedTransactionid } = request.body;

          // consultation_notes may be empty when a consultation is first drafted (before the clinician has typed a note).
          if (consultation_notes === undefined || consultation_notes === null || !patientid || !record_type || !consulationby) {
               return response.status(400).json({ message: "Missing required fields: consultation_notes, record_type, patientid, or consulationby." });
          }

          const tenantId = parseInt(request.query.tenantId.toString());
          const medicalRecordsService = new PrimeMedicalRecords();
          const recordId = await medicalRecordsService.createRecord(
               tenantId,
               {
                    progress_report: consultation_notes,
                    record_type: record_type as any,
                    patientid,
                    consulationby,
                    associatedTransactionid: associatedTransactionid || null
               });
          response.status(201).json({ message: "Record created successfully.", recordId });
     } catch (err) {
          console.error("Error creating record:", err);
          response.status(500).json({ message: "Internal Server Error." });
     }
};

export const getConsultationRecordById = async (request: Request<{}, {}, {}, { consultationid: string, tenantId: string }>, response: Response) => {
     try {
          const { consultationid, tenantId } = request.query;

          if (!consultationid) {
               response.status(400).json({ message: "Record ID is required." });
          } else {
               const tenantIdP = parseInt(tenantId.toString())
               const medicalRecordsService = new PrimeMedicalRecords();
               const record = await medicalRecordsService.getRecordById(tenantIdP, parseInt(consultationid));

               if (!record) {
                    response.status(404).json({ message: "Record not found." });
               } else {
                    response.status(200).json(record);
               }
          }
     } catch (err) {
          console.error("Error fetching record:", err);
          response.status(500).json({ message: "Internal Server Error." });
     }
};

export const updateAConsultationRecord = async (request: Request<{}, {}, Partial<MedicalRecord>, { consultationid: string, tenantId: string }>, response: Response) => {
     try {
          const { consultationid, tenantId } = request.query;
          let updates = request.body;

          if (!consultationid) {
               return response.status(400).json({ message: OperationsFailures.invalidResponseBodyParams + " consultationid not included" });
          }

          // Map consultation_notes to progress_report if provided
          if ('consultation_notes' in request.body) {
               const { consultation_notes, ...rest } = request.body as any;
               updates = { progress_report: consultation_notes, ...rest };
          }

          const parsedConsultationid = parseInt(consultationid);
          const tenantIdP = parseInt(tenantId.toString());
          const medicalRecordsService = new PrimeMedicalRecords();
          const isUpdateSuccess = await medicalRecordsService.updateRecord(tenantIdP, parsedConsultationid, updates);
          response.status(200).json({ status: isUpdateSuccess });
     } catch (err) {
          console.error("Error updating record:", err);
          response.status(500).json({ message: "Internal Server Error." });
     }
};

export const deleteAConsultationRecord = async (request: Request<{}, {}, {}, { consultationid: string, tenantId: string }>, response: Response) => {
     try {
          const { consultationid, tenantId } = request.query;

          if (!consultationid) {
               response.status(400).json({ message: "Record ID is required." });
          } else {
               const tenantIdP = parseInt(tenantId.toString())
               const medicalRecordsService = new PrimeMedicalRecords();
               await medicalRecordsService.deleteRecord(tenantIdP, parseInt(consultationid));
               response.status(200).json({ message: "Record deleted successfully." });
          }
     } catch (err) {
          console.error("Error deleting record:", err);
          response.status(500).json({ message: "Internal Server Error." });
     }
};

export const getAllConsultationRecords = async (request: Request<{}, {}, {}, { search: string, patientid: number, count: number, page: number, tenantId: string }>, response: Response) => {
     try {
          const { count, page, tenantId } = request.query
          const tenantIdP = parseInt(tenantId)
          const search = request.query.search as string | undefined;
          const patient = request.query.patientid
          const medicalRecordsService = new PrimeMedicalRecords();

          const records = await medicalRecordsService.getAllRecords(tenantIdP, page, patient ? parseInt(patient.toString()) : undefined, count, search ? parseInt(search) : undefined);
          response.status(200).json(records);
     } catch (err) {
          console.error("Error fetching all records:", err);
          response.status(500).json({ message: "Internal Server Error." });
     }
};


export const getAllPendingConsultationRecords = async (request: Request<{}, {}, {}, { tenantId: number, count: string, page: string, sortby: 'ASC' | 'DESC' }>, response: Response) => {
     try {
          const { count, page, sortby } = request.query;
          const pageSize = count ? parseInt(count) : 10;
          const tenantId = request.query.tenantId ? parseInt(request.query.tenantId.toString()) : 0;
          const currentPage = page ? parseInt(page) : 1;
          const sortOrder = sortby === 'DESC' ? 'DESC' : 'ASC';

          const pending = await PrimeMedicalRecords.getPendingConsultationServices(tenantId, currentPage, pageSize, sortOrder);
          response.send(pending);
     } catch (err) {
          console.error("Error fetching all records:", err);
          response.status(500).json({ message: "Internal Server Error." });
     }
};

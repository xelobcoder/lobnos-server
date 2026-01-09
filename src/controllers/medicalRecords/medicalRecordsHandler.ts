import { Request, Response } from "express";
import PrimeMedicalRecords, { MedicalRecord } from "../../models/MedicalRecords/medicalRecordClass";
import { customError } from "../../hooks/helper";
import { OperationsFailures } from "../../models/operations/types";


export const createAConsultationRecord = async (request: Request<{}, {}, MedicalRecord, { tenantId: string }>, response: Response) => {
     try {
          const { complaints, hpc, pmh, sh, odq, dhx, se, fh, obsGynecHistory, oe, record_type, patientid, consulationby, associatedTransactionid } = request.body;

          if (!complaints || !patientid || !record_type) {
               response.status(400).json({ message: "Missing required fields: complaints, record_type, or patientid." });
          } else {
               const tenantId = parseInt(request.query.tenantId.toString())
               const medicalRecordsService = new PrimeMedicalRecords();
               const recordId = await medicalRecordsService.createRecord(
                    tenantId,
                    {
                         complaints, hpc, pmh, sh, record_type, odq, dhx, se, fh,
                         obsGynecHistory, oe, consulationby, patientid, associatedTransactionid
                    });
               response.status(201).json({ message: "Record created successfully.", recordId });
          }
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

export const updateAConsultationRecord = async (request: Request<{}, {}, MedicalRecord, { consultationid: string, tenantId: string }>, response: Response) => {
     try {
          const { consultationid, tenantId } = request.query;
          const updates = request.body;

          if (!consultationid) {
               response.status(400).json({ message: OperationsFailures.invalidResponseBodyParams + " consultationid not included" });
          } else {
               const parsedConsultationid = parseInt(consultationid);
               const tenantIdP = parseInt(tenantId.toString())
               const medicalRecordsService = new PrimeMedicalRecords();
               const isUpdateSuccess = await medicalRecordsService.updateRecord(tenantIdP, parsedConsultationid, updates);
               response.status(200).json({ status: isUpdateSuccess });
          }
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

export const getAllConsultationRecords = async (request: Request<{}, {}, {}, { search: string, count: number, page: number, tenantId: string }>, response: Response) => {
     try {
          const { count, page, tenantId } = request.query
          const tenantIdP = parseInt(tenantId)
          const search = request.query.search as string | undefined;
          const medicalRecordsService = new PrimeMedicalRecords();

          const records = await medicalRecordsService.getAllRecords(tenantIdP, page, count, isNaN
               (search as unknown as number) ? search : parseInt(search as string)
          );
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

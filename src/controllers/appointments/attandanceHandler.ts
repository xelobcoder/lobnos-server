import EmployeeShiftService from "../../models/appointments/ShiftsPreferenceAndAvailabillity";
import { Request, Response } from "express";

export const createPreferredShiftHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const record = req.body;
          const createdRecord = await EmployeeShiftService.createPreferredShift(record, tenantId);
          res.status(201).json(createdRecord);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const getAllPreferredShiftsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const records = await EmployeeShiftService.getAllPreferredShifts(tenantId);
          res.status(200).json(records);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const getPreferredShiftHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const { employeeid } = req.params;
          const record = await EmployeeShiftService.getPreferredShift(Number(employeeid), tenantId);
          if (!record) {
               return res.status(404).json({ message: "Record not found" });
          }
          res.status(200).json(record);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const deletePreferredShiftHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const { employeeid, shiftid } = req.params;
          const deletedCount = await EmployeeShiftService.deletePreferredShift(Number(employeeid), Number(shiftid), tenantId);
          if (deletedCount === 0) {
               return res.status(404).json({ message: "Record not found" });
          }
          res.status(200).json({ message: "Record deleted successfully" });
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const createUnavailableDayHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const record = req.body;
          const createdRecord = await EmployeeShiftService.createUnavailableDay(record, tenantId);
          res.status(201).json(createdRecord);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const getAllUnavailableDaysHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const records = await EmployeeShiftService.getAllUnavailableDays(tenantId);
          res.status(200).json(records);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const getUnavailableDayHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const { employeeid } = req.params;
          const record = await EmployeeShiftService.getUnavailableDay(Number(employeeid), tenantId);
          console.log(record);
          if (!record) {
               return res.status(404).json({ message: "Record not found" });
          }
          res.status(200).json(record);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const deleteUnavailableDayHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const { employeeid } = req.params;
          const deletedCount = await EmployeeShiftService.deleteUnavailableDay(Number(employeeid), tenantId);
          if (deletedCount === 0) {
               return res.status(404).json({ message: "Record not found" });
          }
          res.status(200).json({ message: "Record deleted successfully" });
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

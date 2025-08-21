import { Request, Response } from "express";
import StaffAttendance from "../../models/appointments/StaffAttendance";

export const getAllStaffAttendance = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const filters = req.query;
          const attendanceRecords = await staffAttendance.getAll(tenantId, filters);
          res.status(200).json(attendanceRecords);
     } catch (error: any) {
          res.status(500).json({ message: "Failed to fetch attendance records", error: error.message });
     }
};

export const getStaffAttendanceById = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const id = parseInt(req.params.id);
          const attendanceRecord = await staffAttendance.getById(tenantId, id);
          if (attendanceRecord) {
               res.status(200).json(attendanceRecord);
          } else {
               res.status(404).json({ message: "Attendance record not found" });
          }
     } catch (error: any) {
          res.status(500).json({ message: "Failed to fetch attendance record", error: error.message });
     }
};

export const createStaffAttendance = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const attendanceData = req.body;
          const id = await staffAttendance.create(tenantId, attendanceData);
          res.status(201).json({ status: id > 0, message:  id > 0 ? "Attendance record created successfully" : "Failed to create attendance record, this might happen if the records already exist" });
     } catch (error: any) {
          res.status(400).json({ message: "Failed to create attendance record", error: error.message });
     }
};

export const updateStaffAttendance = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const id = parseInt(req.params.id);
          const attendanceData = req.body;
          await staffAttendance.update(tenantId, id, attendanceData);
          res.status(200).json({ message: "Attendance record updated successfully" });
     } catch (error: any) {
          res.status(400).json({ message: "Failed to update attendance record", error: error.message });
     }
};

export const deleteStaffAttendance = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const id = parseInt(req.params.id);
          await staffAttendance.delete(tenantId, id);
          res.status(200).json({ message: "Attendance record deleted successfully" });
     } catch (error: any) {
          res.status(500).json({ message: "Failed to delete attendance record", error: error.message });
     }
};

export const updateAttendanceStatus = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const id = parseInt(req.params.id);
          const { status } = req.body;
          await staffAttendance.updateStatus(tenantId, id, status);
          res.status(200).json({ message: "Attendance status updated successfully" });
     } catch (error: any) {
          res.status(400).json({ message: "Failed to update attendance status", error: error.message });
     }
};

export const bulkCreateStaffAttendance = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const attendanceRecords = req.body;
          const ids = await staffAttendance.bulkCreate(tenantId, attendanceRecords);
          res.status(201).json({ ids, message: "Attendance records created successfully" });
     } catch (error: any) {
          res.status(400).json({ message: "Failed to create attendance records", error: error.message });
     }
};

export const getAttendanceByCycle = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const cycleid = parseInt(req.params.cycleid);
          const attendanceRecords = await staffAttendance.getAttendanceByCycle(tenantId, cycleid);
          res.status(200).json(attendanceRecords);
     } catch (error: any) {
          res.status(500).json({ message: "Failed to fetch attendance records by cycle", error: error.message });
     }
};

export const getAttendanceByEmployee = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const employeeId = parseInt(req.params.employeeId);
          const { startDate, endDate } = req.query;
          const attendanceRecords = await staffAttendance.getAttendanceByEmployee(tenantId, employeeId, startDate as string, endDate as string);
          res.status(200).json(attendanceRecords);
     } catch (error: any) {
          res.status(500).json({ message: "Failed to fetch attendance records by employee", error: error.message });
     }
};

export const countAttendanceByStatus = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const staffAttendance = new StaffAttendance();
          const filters = req.query;
          const counts = await staffAttendance.countByStatus(tenantId, filters);
          res.status(200).json(counts);
     } catch (error: any) {
          res.status(500).json({ message: "Failed to count attendance records by status", error: error.message });
     }
};

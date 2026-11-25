import { Request, Response } from "express";
import AttendanceCycleService from "../../models/appointments/attendanceCycle";
import { responseError } from "../../hooks/helper";
import { PrimeLimsTableroles } from "../../interfaces/database";
import { getAllLogins } from "../../LobnosAuth/createAccount";
import EmployeeShiftService from "../../models/appointments/ShiftsPreferenceAndAvailabillity";
import ShiftService from "../../models/appointments/shfitsServices";


export const createAttendanceCycleHandler = async (req: Request<{}, {}, any, { tenantId: string }>, res: Response) => {
     try {
          const { tenantId } = req.query;
          const tenantIdP = parseInt(tenantId.toString());
          const cycle = await AttendanceCycleService.createAttendanceCycle(tenantIdP, req.body);
          return res.status(201).json({ success: true, data: cycle });
     } catch (error) {
          console.error("Error creating attendance cycle:", error);
          return res.status(500).json({ success: false, message: "Internal Server Error" });
     }
};


export const getAllAttendanceCyclesHandler = async (_req: Request<{}, {}, {}, { tenantId: string }>, res: Response) => {
     try {
          const { tenantId } = _req.query;
          const tenantIdP = parseInt(tenantId.toString());
          const cycles = await AttendanceCycleService.getAllAttendanceCycles(tenantIdP);
          return res.status(200).json({ success: true, data: cycles });
     } catch (error) {
          console.error("Error fetching attendance cycles:", error);
          return res.status(500).json({ success: false, message: "Internal Server Error" });
     }
};


export const getAttendanceCycleHandler = async (req: Request<{id:number}, {}, {}, { tenantId: string }>, res: Response) => {
     try {
          const { tenantId } = req.query;
          const { id } = req.params;
          const tenantIdP = parseInt(tenantId.toString());
          const cycle = await AttendanceCycleService.getAttendanceCycleById(tenantIdP, Number(id));

          if (!cycle) {
               return res.status(404).json({ success: false, message: "Attendance cycle not found" });
          }

          return res.status(200).json({ success: true, data: cycle });
     } catch (error) {
          console.error("Error fetching attendance cycle:", error);
          return res.status(500).json({ success: false, message: "Internal Server Error" });
     }
};


export const updateAttendanceCycleHandler = async (req: Request<{id:number}, {}, any, { tenantId: string }>, res: Response) => {
     try {
          const { tenantId } = req.query;
          const { id } = req.params;
          const updates = req.body;
          const tenantIdP = parseInt(tenantId.toString());
          const updatedRows = await AttendanceCycleService.updateAttendanceCycle(tenantIdP,
               Number(id), updates);
          if (!updatedRows) {
               return res.status(404).json({ success: false, message: "Attendance cycle not found or no changes made" });
          }

          return res.status(200).json({ success: true, message: "Attendance cycle updated successfully" });
     } catch (error) {
          console.error("Error updating attendance cycle:", error);
          return res.status(500).json({ success: false, message: "Internal Server Error" });
     }
};


export const deleteAttendanceCycleHandler = async (req: Request<{id:number}, {}, {}, { tenantId: string }>, res: Response) => {
     try {
          const { tenantId } = req.query;
          const tenantIdP = parseInt(tenantId.toString());
          const { id } = req.params;

          const deletedRows = await AttendanceCycleService.deleteAttendanceCycle(tenantIdP,
               Number(id));
          if (!deletedRows) {
               return res.status(404).json({ success: false, message: "Attendance cycle not found" });
          }

          return res.status(200).json({ success: true, message: "Attendance cycle deleted successfully" });
     } catch (error) {
          console.error("Error deleting attendance cycle:", error);
          return res.status(500).json({ success: false, message: "Internal Server Error" });
     }
};




export const getEmployeeAttendanceSummaryHandler = async (request: Request<{ cycleid: number }, {}, {}, { tenantId: string }>, response: Response) => {
     try {
          const { tenantId } = request.query;
          const cycleid = request.params.cycleid
          const tenantIdP = parseInt(tenantId.toString());
          const employeesList: PrimeLimsTableroles[] = await getAllLogins(tenantIdP,request.query as any);

          if (!Array.isArray(employeesList) || employeesList.length === 0) {
               return response.send({ summary: [], shifts: [] });
          }

         
          const cycleInfo = await AttendanceCycleService.getAttendanceCycleById(tenantIdP,
               cycleid);

          const summary = await Promise.all(
               employeesList.map(async (item: PrimeLimsTableroles) => {
                    const [preferredShifts, unAvailableDays] = await Promise.all([
                         EmployeeShiftService.getPreferredShift(item.employeeid, tenantIdP),
                         EmployeeShiftService.getUnavailableDay(item.employeeid, tenantIdP)
                    ]);

                    return {
                         ...item,
                         preferredShifts,
                         unAvailableDays
                    };
               })
          );

          const shiftsServices = await ShiftService.getAllShifts(tenantIdP);

          response.send({
               cycleInfo,
               summary,
               shifts: shiftsServices,
          });
     } catch (err) {
          responseError(response);
     }
};

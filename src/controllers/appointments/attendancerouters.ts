import { Router } from "express";
import {
     createPreferredShiftHandler,
     getAllPreferredShiftsHandler,
     getPreferredShiftHandler,
     deletePreferredShiftHandler,
     createUnavailableDayHandler,
     getAllUnavailableDaysHandler,
     getUnavailableDayHandler,
     deleteUnavailableDayHandler
} from "./attandanceHandler";

import {
     getAllStaffAttendance,
     getStaffAttendanceById,
     createStaffAttendance,
     updateStaffAttendance,
     deleteStaffAttendance,
     updateAttendanceStatus,
     bulkCreateStaffAttendance,
     getAttendanceByCycle,
     getAttendanceByEmployee,
     countAttendanceByStatus,
} from "./timetableHandlers";


import {
     createShiftHandler,
     getAllShiftsHandler,
     getShiftByIdHandler,
     updateShiftHandler,
     deleteShiftHandler,
     loadDefaultShiftsHandler,
} from "./shiftsHandlers";
import { createAttendanceCycleHandler, getAllAttendanceCyclesHandler, getAttendanceCycleHandler, updateAttendanceCycleHandler, deleteAttendanceCycleHandler, getEmployeeAttendanceSummaryHandler } from "./AttendanceCycleServiceHandler";


import {
     createTask,
     getTask,
     updateTask,
     deleteTask,
     listTasks,
} from './tasksHandlers'

const router = Router();

// Preferred Shifts routes
router.post("/api/v1/attendance/preferred-shifts", createPreferredShiftHandler);
router.get("/api/v1/attendance/preferred-shifts", getAllPreferredShiftsHandler);
router.get("/api/v1/attendance/preferred-shifts/:employeeid", getPreferredShiftHandler);
router.delete("/api/v1/attendance/preferred-shifts/:employeeid/:shiftid", deletePreferredShiftHandler);



// Unavailable Days routes
router.post("/api/v1/employee/unavailable-days", createUnavailableDayHandler);
router.get("/api/v1/employee/unavailable-days", getAllUnavailableDaysHandler);
router.get("/api/v1/employee/unavailable-days/:employeeid", getUnavailableDayHandler);
router.delete("/api/v1/employee/unavailable-days/:employeeid", deleteUnavailableDayHandler);



router.post("/api/v1/attendance/shifts", createShiftHandler);
router.get("/api/v1/attendance/shifts", getAllShiftsHandler);
router.get("/api/v1/attendance/shifts/:id", getShiftByIdHandler);
router.put("/api/v1/attendance/shifts/:id", updateShiftHandler);
router.delete("/api/v1/attendance/shifts/:id", deleteShiftHandler);

//  cycles

router.post("/api/v1/attendance/cycles", createAttendanceCycleHandler);
router.get("/api/v1/attendance/cycles", getAllAttendanceCyclesHandler);
router.get("/api/v1/attendance/cycles/:id", getAttendanceCycleHandler);
router.put("/api/v1/attendance/cycles/:id", updateAttendanceCycleHandler);
router.delete("/api/v1/attendance/cycles/:id", deleteAttendanceCycleHandler);





router.get("/api/v1/attendance/employees/summary/:cycleid", getEmployeeAttendanceSummaryHandler);


router.get("/api/v1/attendance/timetable", getAllStaffAttendance);
router.get("/api/v1/attendance/timetable/:id", getStaffAttendanceById);
router.post("/api/v1/attendance/timetable", createStaffAttendance);
router.put("/api/v1/attendance/timetable/:id", updateStaffAttendance);
router.delete("/api/v1/attendance/timetable/:id", deleteStaffAttendance);
router.patch("/api/v1/attendance/timetable/:id/status", updateAttendanceStatus);
router.post("/api/v1/attendance/timetable/bulk", bulkCreateStaffAttendance);
router.get("/api/v1/attendance/timetable/cycle/:cycleid", getAttendanceByCycle);
router.get("/api/v1/attendance/timetable/employee/:employeeId", getAttendanceByEmployee);
router.get("/api/v1/attendance/timetable/count", countAttendanceByStatus);

router.post('/api/v1/primelims/tasks', createTask);
router.get('/api/v1/primelims/tasks/:id', getTask);
router.put('/api/v1/primelims/tasks/:id', updateTask);
router.delete('/api/v1/primelims/tasks/:id', deleteTask);
router.get('/api/v1/primelims/tasks', listTasks);

export default router;




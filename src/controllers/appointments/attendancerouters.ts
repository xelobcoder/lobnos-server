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
import { handleOverLoad } from "../../hooks/helper";

const router = Router();

// Preferred Shifts routes
router.post("/api/v1/attendance/preferred-shifts", createPreferredShiftHandler);
router.get("/api/v1/attendance/preferred-shifts", getAllPreferredShiftsHandler);
router.get("/api/v1/attendance/preferred-shifts/:employeeid", handleOverLoad(getPreferredShiftHandler));
router.delete("/api/v1/attendance/preferred-shifts/:employeeid/:shiftid", handleOverLoad(deletePreferredShiftHandler));



// Unavailable Days routes
router.post("/api/v1/employee/unavailable-days", createUnavailableDayHandler);
router.get("/api/v1/employee/unavailable-days", getAllUnavailableDaysHandler);
router.get("/api/v1/employee/unavailable-days/:employeeid", handleOverLoad(getUnavailableDayHandler));
router.delete("/api/v1/employee/unavailable-days/:employeeid", handleOverLoad(deleteUnavailableDayHandler));



router.post("/api/v1/attendance/shifts", createShiftHandler);
router.get("/api/v1/attendance/shifts", getAllShiftsHandler);
router.get("/api/v1/attendance/shifts/:id", handleOverLoad(getShiftByIdHandler));
router.put("/api/v1/attendance/shifts/:id", handleOverLoad(updateShiftHandler));
router.delete("/api/v1/attendance/shifts/:id", handleOverLoad(deleteShiftHandler));

//  cycles

router.post("/api/v1/attendance/cycles", handleOverLoad(createAttendanceCycleHandler));
router.get("/api/v1/attendance/cycles",handleOverLoad( getAllAttendanceCyclesHandler));
router.get("/api/v1/attendance/cycles/:id", handleOverLoad(getAttendanceCycleHandler));
router.put("/api/v1/attendance/cycles/:id", handleOverLoad(updateAttendanceCycleHandler));
router.delete("/api/v1/attendance/cycles/:id", handleOverLoad(deleteAttendanceCycleHandler));





router.get("/api/v1/attendance/employees/summary/:cycleid", handleOverLoad(getEmployeeAttendanceSummaryHandler));


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




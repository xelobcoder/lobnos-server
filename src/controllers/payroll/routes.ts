import { Router } from 'express';
import * as compensationController from './compensationController';
import * as payrollController from './payrollController';
import * as salaryGradeController from './salaryGradeController';
import * as attendanceController from './attendanceController';
import * as taxConfigurationController from './taxConfigurationController';
import * as payrollAnalyticsController from './PayrollAnalyticsController';


const payrollRouter = Router();
payrollRouter.post('/compensation', compensationController.createCompensationHandler);
payrollRouter.get('/compensation/employee/:employeeid', compensationController.getCompensationByEmployeeHandler);
payrollRouter.get('/compensation/employee/:employeeid/active', compensationController.getActiveCompensationHandler);
payrollRouter.get('/compensation', compensationController.getAllActiveCompensationsHandler);
payrollRouter.get('/compensation/:id', compensationController.getCompensationByIdHandler);
payrollRouter.put('/compensation/:id', compensationController.updateCompensationHandler);
payrollRouter.post('/compensation/employee/:employeeid/history', compensationController.createCompensationWithHistoryHandler);
payrollRouter.delete('/compensation/:id', compensationController.deactivateCompensationHandler);
payrollRouter.post('/salary-grades', salaryGradeController.createSalaryGradeHandler);
payrollRouter.get('/salary-grades', salaryGradeController.getAllSalaryGradesHandler);
payrollRouter.get('/salary-grades/:id', salaryGradeController.getSalaryGradeByIdHandler);
payrollRouter.get('/salary-grades/name/:name', salaryGradeController.getSalaryGradeByNameHandler);
payrollRouter.put('/salary-grades/:id', salaryGradeController.updateSalaryGradeHandler);
payrollRouter.delete('/salary-grades/:id', salaryGradeController.deactivateSalaryGradeHandler);
payrollRouter.get('/salary-grades/range', salaryGradeController.getSalaryGradesInRangeHandler);
payrollRouter.post('/attendance', attendanceController.createAttendanceHandler);
payrollRouter.get('/attendance/:id', attendanceController.getAttendanceByIdHandler);
payrollRouter.get('/attendance/employee/:employeeid/date/:date', attendanceController.getAttendanceByEmployeeAndDateHandler);
payrollRouter.get('/attendance/employee/:employeeid', attendanceController.getEmployeeAttendanceByDateRangeHandler);
payrollRouter.put('/attendance/:id', attendanceController.updateAttendanceHandler);
payrollRouter.get('/attendance', attendanceController.getAttendanceByDateRangeHandler);
payrollRouter.get('/attendance/employee/:employeeid/summary', attendanceController.getAttendanceSummaryHandler);
payrollRouter.post('/attendance/clock-in', attendanceController.clockInHandler);
payrollRouter.post('/attendance/clock-out', attendanceController.clockOutHandler);
payrollRouter.get('/attendance/overtime/pending', attendanceController.getPendingOvertimeApprovalsHandler);
payrollRouter.post('/attendance/:id/approve-overtime', attendanceController.approveOvertimeHandler);
payrollRouter.post('/attendance/bulk', attendanceController.bulkCreateAttendanceHandler);
payrollRouter.post('/tax-configurations', taxConfigurationController.createTaxConfigurationHandler);
payrollRouter.get('/tax-configurations', taxConfigurationController.getAllTaxConfigurationsHandler);
payrollRouter.get('/tax-configurations/active', taxConfigurationController.getActiveTaxConfigurationHandler);
payrollRouter.get('/tax-configurations/:id', taxConfigurationController.getTaxConfigurationByIdHandler);
payrollRouter.get('/tax-configurations/year/:taxYear', taxConfigurationController.getTaxConfigurationByYearHandler);
payrollRouter.put('/tax-configurations/:id', taxConfigurationController.updateTaxConfigurationHandler);
payrollRouter.patch('/tax-configurations/:id/status', taxConfigurationController.toggleTaxConfigurationStatusHandler);
payrollRouter.delete('/tax-configurations/:id', taxConfigurationController.deleteTaxConfigurationHandler);
payrollRouter.get('/tax-configurations/:id/audit', taxConfigurationController.getTaxConfigurationAuditHistoryHandler);

// Analytics routes - BEFORE parameterized routes
payrollRouter.get('/analytics', payrollAnalyticsController.getPayrollAnalyticsHandler);
payrollRouter.get('/analytics/periods', payrollAnalyticsController.getPayrollPeriodAnalyticsHandler);
payrollRouter.get('/analytics/compensation', payrollAnalyticsController.getCompensationAnalyticsHandler);
payrollRouter.get('/analytics/attendance', payrollAnalyticsController.getAttendanceAnalyticsHandler);
payrollRouter.get('/analytics/leave', payrollAnalyticsController.getLeaveAnalyticsHandler);
payrollRouter.get('/analytics/allowance-bonus', payrollAnalyticsController.getAllowanceBonusAnalyticsHandler);
payrollRouter.get('/analytics/deductions', payrollAnalyticsController.getDeductionAnalyticsHandler);
payrollRouter.get('/analytics/trend', payrollAnalyticsController.getPayrollTrendAnalyticsHandler);

// History routes - BEFORE parameterized routes
payrollRouter.get('/history', payrollController.getAllPayrollHistoryHandler);
payrollRouter.get('/reversals', payrollController.getPayrollReversalsHandler);
payrollRouter.get('/reversal-errors', payrollController.getPayrollReversalErrorsHandler);
payrollRouter.post('/periods', payrollController.createPayrollPeriodHandler);
payrollRouter.get('/periods', payrollController.getAllPayrollPeriodsHandler);
payrollRouter.get('/periods/:id/status', payrollController.getPayrollStatusHandler);
payrollRouter.get('/periods/:id/transactions', payrollController.getPayrollTransactionsHandler);
payrollRouter.get('/periods/:id', payrollController.getPayrollPeriodByIdHandler);
payrollRouter.post('/periods/:id/process', payrollController.processPayrollHandler);
payrollRouter.post('/periods/:id/approve', payrollController.approvePayrollHandler);
payrollRouter.post('/periods/:id/lock', payrollController.lockPayrollHandler);
payrollRouter.post('/periods/:id/mark-paid', payrollController.markPayrollPaidHandler);
payrollRouter.post('/periods/:id/reverse', payrollController.reversePayrollPeriodHandler);
payrollRouter.post('/periods/:id/recalculate', payrollController.recalculateEmployeeHandler);
payrollRouter.get('/employee/:employeeid/history', payrollController.getEmployeePayrollHistoryHandler);
payrollRouter.get('/employee/:employeeid/ytd', payrollController.getEmployeeYTDHandler);
payrollRouter.get('/routes', (req, res) => {
     const routes = [
          // Compensation endpoints
          { method: 'POST', path: '/api/v1/payroll/compensation', description: 'Create compensation record' },
          { method: 'GET', path: '/api/v1/payroll/compensation', description: 'Get all compensations (use ?status=active for active only)' },
          { method: 'GET', path: '/api/v1/payroll/compensation/:id', description: 'Get compensation by ID' },
          { method: 'GET', path: '/api/v1/payroll/compensation/employee/:employeeid', description: 'Get employee compensation history' },
          { method: 'GET', path: '/api/v1/payroll/compensation/employee/:employeeid/active', description: 'Get active compensation' },
          { method: 'PUT', path: '/api/v1/payroll/compensation/:id', description: 'Update compensation' },
          { method: 'POST', path: '/api/v1/payroll/compensation/employee/:employeeid/history', description: 'Create compensation with history' },
          { method: 'DELETE', path: '/api/v1/payroll/compensation/:id', description: 'Deactivate compensation' },

          // Salary grade endpoints
          { method: 'POST', path: '/api/v1/payroll/salary-grades', description: 'Create salary grade' },
          { method: 'GET', path: '/api/v1/payroll/salary-grades', description: 'Get all salary grades (use ?activeOnly=false for all)' },
          { method: 'GET', path: '/api/v1/payroll/salary-grades/:id', description: 'Get salary grade by ID' },
          { method: 'GET', path: '/api/v1/payroll/salary-grades/name/:name', description: 'Get salary grade by name' },
          { method: 'PUT', path: '/api/v1/payroll/salary-grades/:id', description: 'Update salary grade' },
          { method: 'DELETE', path: '/api/v1/payroll/salary-grades/:id', description: 'Deactivate salary grade' },
          { method: 'GET', path: '/api/v1/payroll/salary-grades/range?minSalary=X&maxSalary=Y', description: 'Get salary grades within salary range' },

          // Attendance endpoints
          { method: 'POST', path: '/api/v1/payroll/attendance', description: 'Create attendance record' },
          { method: 'GET', path: '/api/v1/payroll/attendance/:id', description: 'Get attendance by ID' },
          { method: 'GET', path: '/api/v1/payroll/attendance/employee/:employeeid/date/:date', description: 'Get attendance by employee and date' },
          { method: 'GET', path: '/api/v1/payroll/attendance/employee/:employeeid?startDate=X&endDate=Y', description: 'Get employee attendance by date range' },
          { method: 'PUT', path: '/api/v1/payroll/attendance/:id', description: 'Update attendance record' },
          { method: 'GET', path: '/api/v1/payroll/attendance?startDate=X&endDate=Y', description: 'Get attendance by date range' },
          { method: 'GET', path: '/api/v1/payroll/attendance/employee/:employeeid/summary?startDate=X&endDate=Y', description: 'Get attendance summary for employee' },
          { method: 'POST', path: '/api/v1/payroll/attendance/clock-in', description: 'Record clock in' },
          { method: 'POST', path: '/api/v1/payroll/attendance/clock-out', description: 'Record clock out' },
          { method: 'GET', path: '/api/v1/payroll/attendance/overtime/pending', description: 'Get pending overtime approvals' },
          { method: 'POST', path: '/api/v1/payroll/attendance/:id/approve-overtime', description: 'Approve overtime' },
          { method: 'POST', path: '/api/v1/payroll/attendance/bulk', description: 'Bulk create attendance records' },

          // Tax configuration endpoints
          { method: 'POST', path: '/api/v1/payroll/tax-configurations', description: 'Create tax configuration' },
          { method: 'GET', path: '/api/v1/payroll/tax-configurations', description: 'Get all tax configurations' },
          { method: 'GET', path: '/api/v1/payroll/tax-configurations/active', description: 'Get active tax configuration' },
          { method: 'GET', path: '/api/v1/payroll/tax-configurations/:id', description: 'Get tax configuration by ID' },
          { method: 'GET', path: '/api/v1/payroll/tax-configurations/year/:taxYear', description: 'Get tax configuration by year' },
          { method: 'PUT', path: '/api/v1/payroll/tax-configurations/:id', description: 'Update tax configuration' },
          { method: 'PATCH', path: '/api/v1/payroll/tax-configurations/:id/status', description: 'Activate/Deactivate tax configuration' },
          { method: 'DELETE', path: '/api/v1/payroll/tax-configurations/:id', description: 'Delete tax configuration' },

          // Payroll period endpoints
          { method: 'POST', path: '/api/v1/payroll/periods', description: 'Create payroll period' },
          { method: 'GET', path: '/api/v1/payroll/periods', description: 'Get all periods' },
          { method: 'GET', path: '/api/v1/payroll/periods/:id', description: 'Get period by ID' },
          { method: 'GET', path: '/api/v1/payroll/periods/:id/status', description: 'Get period status' },
          { method: 'GET', path: '/api/v1/payroll/periods/:id/transactions', description: 'Get period transactions' },
          { method: 'POST', path: '/api/v1/payroll/periods/:id/process', description: 'Process payroll' },
          { method: 'POST', path: '/api/v1/payroll/periods/:id/approve', description: 'Approve payroll' },
          { method: 'POST', path: '/api/v1/payroll/periods/:id/lock', description: 'Lock payroll' },
          { method: 'POST', path: '/api/v1/payroll/periods/:id/mark-paid', description: 'Mark payroll as paid' },
          { method: 'POST', path: '/api/v1/payroll/periods/:id/recalculate', description: 'Recalculate employee' },

          // Statutory deduction endpoints
          { method: 'POST', path: '/api/v1/payroll/statutory-deductions/employee/:employeeid', description: 'Create statutory deduction' },
          { method: 'GET', path: '/api/v1/payroll/statutory-deductions/employee/:employeeid', description: 'Get statutory deduction by employee' },
          { method: 'PUT', path: '/api/v1/payroll/statutory-deductions/:id', description: 'Update statutory deduction' },
          { method: 'GET', path: '/api/v1/payroll/statutory-deductions/ssnit/:ssnitNumber', description: 'Get by SSNIT number' },
          { method: 'GET', path: '/api/v1/payroll/statutory-deductions/tin/:tinNumber', description: 'Get by TIN number' },

          // Employee endpoints
          { method: 'GET', path: '/api/v1/payroll/employee/:employeeid/history', description: 'Get payroll history' },
          { method: 'GET', path: '/api/v1/payroll/employee/:employeeid/ytd', description: 'Get YTD totals' },

          // History endpoints
          { method: 'GET', path: '/api/v1/payroll/history?page=1&count=50&sortby=ASC', description: 'Get lifetime payroll summaries for all employees (paginated, sortable by employee name)' },

          // Analytics endpoints
          { method: 'GET', path: '/api/v1/payroll/analytics?startDate=X&endDate=Y&topEarnersLimit=10', description: 'Get comprehensive payroll analytics' },
          { method: 'GET', path: '/api/v1/payroll/analytics/periods?startDate=X&endDate=Y', description: 'Get payroll period analytics' },
          { method: 'GET', path: '/api/v1/payroll/analytics/compensation?startDate=X&endDate=Y', description: 'Get compensation distribution analytics' },
          { method: 'GET', path: '/api/v1/payroll/analytics/attendance?startDate=X&endDate=Y', description: 'Get attendance analytics' },
          { method: 'GET', path: '/api/v1/payroll/analytics/leave?startDate=X&endDate=Y', description: 'Get leave statistics' },
          { method: 'GET', path: '/api/v1/payroll/analytics/allowance-bonus?startDate=X&endDate=Y', description: 'Get allowance and bonus analytics' },
          { method: 'GET', path: '/api/v1/payroll/analytics/deductions?startDate=X&endDate=Y', description: 'Get deduction analytics (statutory and other)' },
          { method: 'GET', path: '/api/v1/payroll/analytics/trend?startDate=X&endDate=Y', description: 'Get payroll trend over time' }
     ];

     res.json({
          status: 'success',
          statusCode: 200,
          message: 'Payroll API Routes',
          total_routes: routes.length,
          routes
     });
});

export default payrollRouter;

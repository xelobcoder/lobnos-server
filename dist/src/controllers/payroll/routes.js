"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const compensationController = __importStar(require("./compensationController"));
const bonusController = __importStar(require("./bonusController"));
const allowanceController = __importStar(require("./allowanceController"));
const payrollController = __importStar(require("./payrollController"));
const salaryGradeController = __importStar(require("./salaryGradeController"));
const attendanceController = __importStar(require("./attendanceController"));
const leaveController = __importStar(require("./leaveController"));
const deductionController = __importStar(require("./deductionController"));
const taxConfigurationController = __importStar(require("./taxConfigurationController"));
const taxReliefController = __importStar(require("./taxReliefController"));
const payrollAnalyticsController = __importStar(require("./PayrollAnalyticsController"));
const helper_1 = require("../../hooks/helper");
const payrollRouter = (0, express_1.Router)();
payrollRouter.post('/compensation', compensationController.createCompensationHandler);
payrollRouter.post('/allowances', allowanceController.createAllowanceHandler);
payrollRouter.get('/allowances', allowanceController.getAllActiveAllowancesHandler);
payrollRouter.get('/allowances/types', allowanceController.getAllowanceTypesHandler);
payrollRouter.get('/allowances/employee/:employeeid', allowanceController.getAllowancesByEmployeeHandler);
payrollRouter.get('/allowances/employee/:employeeid/active', allowanceController.getActiveAllowancesByEmployeeHandler);
payrollRouter.get('/allowances/:id', allowanceController.getAllowanceByIdHandler);
payrollRouter.put('/allowances/:id', allowanceController.updateAllowanceHandler);
payrollRouter.delete('/allowances/:id', allowanceController.deactivateAllowanceHandler);
payrollRouter.post('/bonuses', bonusController.createBonusHandler);
payrollRouter.get('/bonuses/employee/:employeeid', bonusController.getBonusesByEmployeeHandler);
payrollRouter.get('/bonuses/:id', bonusController.getBonusByIdHandler);
payrollRouter.put('/bonuses/:id', bonusController.updateBonusHandler);
payrollRouter.delete('/bonuses/:id', bonusController.deleteBonusHandler);
payrollRouter.get('/compensation/employee/:employeeid', compensationController.getCompensationByEmployeeHandler);
payrollRouter.get('/compensation/employee/:employeeid/active', compensationController.getActiveCompensationHandler);
payrollRouter.get('/compensation', compensationController.getAllActiveCompensationsHandler);
payrollRouter.get('/compensation/:id', compensationController.getCompensationByIdHandler);
payrollRouter.get('/compensation/payroll/active', compensationController.getActiveCompensationHandler);
payrollRouter.put('/compensation/:id', compensationController.updateCompensationHandler);
payrollRouter.post('/compensation/employee/:employeeid/history', compensationController.createCompensationWithHistoryHandler);
payrollRouter.delete('/compensation/:id', compensationController.deactivateCompensationHandler);
payrollRouter.post('/salary-grades', salaryGradeController.createSalaryGradeHandler);
payrollRouter.get('/salary-grades', salaryGradeController.getAllSalaryGradesHandler);
payrollRouter.get('/salary-grades/roles', salaryGradeController.getSalaryGradeRolesHandler);
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
payrollRouter.post('/leave', leaveController.createLeaveHandler);
payrollRouter.get('/leave/status/:status', leaveController.getLeavesByStatusHandler);
payrollRouter.get('/leave/employee/:employeeid/summary', leaveController.getLeaveSummaryByEmployeeHandler);
payrollRouter.get('/leave/employee/:employeeid', leaveController.getLeavesByEmployeeIdHandler);
payrollRouter.get('/leave/balance/:employeeid', leaveController.getLeaveBalanceHandler);
payrollRouter.post('/leave/balance/initialize', leaveController.initializeLeaveBalanceHandler);
payrollRouter.put('/leave/balance/:id', leaveController.updateLeaveBalanceHandler);
payrollRouter.get('/leave/on-date', leaveController.getEmployeesOnLeaveByDateHandler);
payrollRouter.get('/leave', leaveController.getLeavesByDateRangeHandler);
payrollRouter.get('/leave/:id', leaveController.getLeaveByIdHandler);
payrollRouter.put('/leave/:id', leaveController.updateLeaveHandler);
payrollRouter.post('/leave/:id/approve', leaveController.approveLeaveHandler);
payrollRouter.post('/leave/:id/reject', leaveController.rejectLeaveHandler);
payrollRouter.post('/leave/:id/cancel', leaveController.cancelLeaveHandler);
payrollRouter.post('/tax-configurations', taxConfigurationController.createTaxConfigurationHandler);
payrollRouter.get('/tax-configurations', taxConfigurationController.getAllTaxConfigurationsHandler);
payrollRouter.get('/tax-configurations/active', taxConfigurationController.getActiveTaxConfigurationHandler);
payrollRouter.get('/tax-configurations/:id', taxConfigurationController.getTaxConfigurationByIdHandler);
payrollRouter.get('/tax-configurations/year/:taxYear', taxConfigurationController.getTaxConfigurationByYearHandler);
payrollRouter.put('/tax-configurations/:id', taxConfigurationController.updateTaxConfigurationHandler);
payrollRouter.patch('/tax-configurations/:id/status', taxConfigurationController.toggleTaxConfigurationStatusHandler);
payrollRouter.delete('/tax-configurations/:id', taxConfigurationController.deleteTaxConfigurationHandler);
payrollRouter.get('/tax-configurations/:id/audit', taxConfigurationController.getTaxConfigurationAuditHistoryHandler);
payrollRouter.post('/tax-reliefs', taxReliefController.createTaxReliefHandler);
payrollRouter.get('/tax-reliefs', taxReliefController.getAllTaxReliefsHandler);
payrollRouter.get('/tax-reliefs/:id', taxReliefController.getTaxReliefByIdHandler);
payrollRouter.put('/tax-reliefs/:id', taxReliefController.updateTaxReliefHandler);
payrollRouter.delete('/tax-reliefs/:id', taxReliefController.deactivateTaxReliefHandler);
payrollRouter.post('/deduction-definitions', deductionController.createDeductionDefinitionHandler);
payrollRouter.get('/deduction-definitions', deductionController.getAllDeductionDefinitionsHandler);
payrollRouter.get('/deduction-definitions/:id', deductionController.getDeductionDefinitionByIdHandler);
payrollRouter.put('/deduction-definitions/:id', deductionController.updateDeductionDefinitionHandler);
payrollRouter.delete('/deduction-definitions/:id', deductionController.deactivateDeductionDefinitionHandler);
payrollRouter.post('/other-deductions', deductionController.createOtherDeductionHandler);
payrollRouter.get('/other-deductions', deductionController.getAllOtherDeductionsHandler);
payrollRouter.get('/other-deductions/active', deductionController.getActiveOtherDeductionsHandler);
payrollRouter.get('/other-deductions/pending-approvals', deductionController.getPendingOtherDeductionApprovalsHandler);
payrollRouter.get('/other-deductions/employee/:employeeid', deductionController.getOtherDeductionsByEmployeeHandler);
payrollRouter.get('/other-deductions/:id', deductionController.getOtherDeductionByIdHandler);
payrollRouter.put('/other-deductions/:id', deductionController.updateOtherDeductionHandler);
payrollRouter.delete('/other-deductions/:id', deductionController.deactivateOtherDeductionHandler);
payrollRouter.get('/other-deductions/:id/deactivate', deductionController.deactivateOtherDeductionHandler);
payrollRouter.post('/other-deductions/:id/deactivate', deductionController.deactivateOtherDeductionHandler);
payrollRouter.post('/other-deductions/:id/approve', deductionController.approveOtherDeductionHandler);
payrollRouter.post('/other-deductions/:id/loan-adjustment', (0, helper_1.handleOverLoad)(deductionController.createLoanAdjustmentHandler));
payrollRouter.post('/deductions/other', deductionController.createOtherDeductionHandler);
payrollRouter.get('/deductions/other', deductionController.getAllOtherDeductionsHandler);
payrollRouter.get('/deductions/other/active', deductionController.getActiveOtherDeductionsHandler);
payrollRouter.get('/deductions/other/pending-approvals', deductionController.getPendingOtherDeductionApprovalsHandler);
payrollRouter.get('/deductions/other/employee/:employeeid', deductionController.getOtherDeductionsByEmployeeHandler);
payrollRouter.get('/deductions/other/:id', deductionController.getOtherDeductionByIdHandler);
payrollRouter.get('/deductions/other/:id/ledger', deductionController.getOtherDeductionLedgerHandler);
payrollRouter.put('/deductions/other/:id', deductionController.updateOtherDeductionHandler);
payrollRouter.delete('/deductions/other/:id', deductionController.deactivateOtherDeductionHandler);
payrollRouter.get('/deductions/other/:id/deactivate', deductionController.deactivateOtherDeductionHandler);
payrollRouter.post('/deductions/other/:id/deactivate', deductionController.deactivateOtherDeductionHandler);
payrollRouter.post('/deductions/other/:id/approve', deductionController.approveOtherDeductionHandler);
payrollRouter.post('/deductions/other/:id/loan-adjustment', (0, helper_1.handleOverLoad)(deductionController.createLoanAdjustmentHandler));
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
payrollRouter.post('/periods/create-next', payrollController.createNextPayrollPeriodHandler);
payrollRouter.get('/periods', payrollController.getAllPayrollPeriodsHandler);
payrollRouter.get('/periods/:id/status', payrollController.getPayrollStatusHandler);
payrollRouter.get('/periods/:id/transactions', payrollController.getPayrollTransactionsHandler);
payrollRouter.get('/periods/:id', payrollController.getPayrollPeriodByIdHandler);
payrollRouter.delete('/periods/:id', payrollController.deletePayrollPeriodHandler);
payrollRouter.post('/periods/:id/process', payrollController.processPayrollHandler);
payrollRouter.post('/periods/:id/approve', payrollController.approvePayrollHandler);
payrollRouter.post('/periods/:id/lock', payrollController.lockPayrollHandler);
payrollRouter.post('/periods/:id/mark-paid', payrollController.markPayrollPaidHandler);
payrollRouter.post('/periods/:id/revert-status', payrollController.revertPayrollPeriodStatusHandler);
payrollRouter.post('/periods/:id/reverse', payrollController.reversePayrollPeriodHandler);
payrollRouter.post('/periods/:id/recalculate', payrollController.recalculateEmployeeHandler);
payrollRouter.post('/periods/:id/recalculate-period', payrollController.recalculatePayrollPeriodHandler);
payrollRouter.get('/employee/:employeeid/history', payrollController.getEmployeePayrollHistoryHandler);
payrollRouter.get('/employee/:employeeid/ytd', payrollController.getEmployeeYTDHandler);
payrollRouter.get('/routes', (req, res) => {
    const routes = [
        // Bonus endpoints
        { method: 'POST', path: '/api/v1/payroll/bonuses', description: 'Create bonus record' },
        { method: 'GET', path: '/api/v1/payroll/bonuses/employee/:employeeid', description: 'Get all bonuses for employee' },
        { method: 'GET', path: '/api/v1/payroll/bonuses/:id', description: 'Get bonus by ID' },
        { method: 'PUT', path: '/api/v1/payroll/bonuses/:id', description: 'Update bonus record' },
        { method: 'DELETE', path: '/api/v1/payroll/bonuses/:id', description: 'Delete bonus record if not paid' },
        // Compensation endpoints
        { method: 'POST', path: '/api/v1/payroll/compensation', description: 'Create compensation record' },
        { method: 'GET', path: '/api/v1/payroll/compensation', description: 'Get all compensations (use ?status=active for active only)' },
        { method: 'GET', path: '/api/v1/payroll/compensation/:id', description: 'Get compensation by ID' },
        { method: 'GET', path: '/api/v1/payroll/compensation/employee/:employeeid', description: 'Get employee compensation history' },
        { method: 'GET', path: '/api/v1/payroll/compensation/employee/:employeeid/active', description: 'Get active compensation' },
        { method: 'PUT', path: '/api/v1/payroll/compensation/:id', description: 'Update compensation' },
        { method: 'POST', path: '/api/v1/payroll/compensation/employee/:employeeid/history', description: 'Create compensation with history' },
        { method: 'DELETE', path: '/api/v1/payroll/compensation/:id', description: 'Deactivate compensation' },
        // Allowance endpoints
        { method: 'POST', path: '/api/v1/payroll/allowances', description: 'Create allowance record' },
        { method: 'GET', path: '/api/v1/payroll/allowances', description: 'Get all active allowances' },
        { method: 'GET', path: '/api/v1/payroll/allowances/types', description: 'Get supported allowance types' },
        { method: 'GET', path: '/api/v1/payroll/allowances/employee/:employeeid', description: 'Get allowance history for employee' },
        { method: 'GET', path: '/api/v1/payroll/allowances/employee/:employeeid/active', description: 'Get active allowances for employee' },
        { method: 'GET', path: '/api/v1/payroll/allowances/:id', description: 'Get allowance by ID' },
        { method: 'PUT', path: '/api/v1/payroll/allowances/:id', description: 'Update allowance record' },
        { method: 'DELETE', path: '/api/v1/payroll/allowances/:id', description: 'Deactivate allowance record' },
        // Salary grade endpoints
        { method: 'POST', path: '/api/v1/payroll/salary-grades', description: 'Create salary grade' },
        { method: 'GET', path: '/api/v1/payroll/salary-grades', description: 'Get all salary grades (use ?activeOnly=false for all)' },
        { method: 'GET', path: '/api/v1/payroll/salary-grades/roles', description: 'Get available role names for salary grade mapping' },
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
        // Leave endpoints
        { method: 'POST', path: '/api/v1/payroll/leave', description: 'Create leave request' },
        { method: 'GET', path: '/api/v1/payroll/leave?startDate=X&endDate=Y', description: 'Get leave requests by date range' },
        { method: 'GET', path: '/api/v1/payroll/leave/:id', description: 'Get leave request by ID' },
        { method: 'PUT', path: '/api/v1/payroll/leave/:id', description: 'Update leave request' },
        { method: 'POST', path: '/api/v1/payroll/leave/:id/approve', description: 'Approve leave request' },
        { method: 'POST', path: '/api/v1/payroll/leave/:id/reject', description: 'Reject leave request' },
        { method: 'POST', path: '/api/v1/payroll/leave/:id/cancel', description: 'Cancel approved leave request' },
        { method: 'GET', path: '/api/v1/payroll/leave/status/:status', description: 'Get leave requests by status' },
        { method: 'GET', path: '/api/v1/payroll/leave/employee/:employeeid', description: 'Get leave requests for employee' },
        { method: 'GET', path: '/api/v1/payroll/leave/employee/:employeeid/summary?year=YYYY', description: 'Get leave summary for employee by year' },
        { method: 'GET', path: '/api/v1/payroll/leave/on-date?date=YYYY-MM-DD', description: 'Get employees on leave for a specific date' },
        { method: 'GET', path: '/api/v1/payroll/leave/balance/:employeeid?year=YYYY', description: 'Get leave balance for employee and year' },
        { method: 'POST', path: '/api/v1/payroll/leave/balance/initialize', description: 'Initialize leave balance for year' },
        { method: 'PUT', path: '/api/v1/payroll/leave/balance/:id', description: 'Update leave balance' },
        // Tax configuration endpoints
        { method: 'POST', path: '/api/v1/payroll/tax-configurations', description: 'Create tax configuration' },
        { method: 'GET', path: '/api/v1/payroll/tax-configurations', description: 'Get all tax configurations' },
        { method: 'GET', path: '/api/v1/payroll/tax-configurations/active', description: 'Get active tax configuration' },
        { method: 'GET', path: '/api/v1/payroll/tax-configurations/:id', description: 'Get tax configuration by ID' },
        { method: 'GET', path: '/api/v1/payroll/tax-configurations/year/:taxYear', description: 'Get tax configuration by year' },
        { method: 'PUT', path: '/api/v1/payroll/tax-configurations/:id', description: 'Update tax configuration' },
        { method: 'PATCH', path: '/api/v1/payroll/tax-configurations/:id/status', description: 'Activate/Deactivate tax configuration' },
        { method: 'DELETE', path: '/api/v1/payroll/tax-configurations/:id', description: 'Delete tax configuration' },
        { method: 'POST', path: '/api/v1/payroll/tax-reliefs', description: 'Create dynamic tax relief or exemption' },
        { method: 'GET', path: '/api/v1/payroll/tax-reliefs', description: 'Get tax reliefs (use ?activeOnly=false for all)' },
        { method: 'GET', path: '/api/v1/payroll/tax-reliefs/:id', description: 'Get tax relief by ID' },
        { method: 'PUT', path: '/api/v1/payroll/tax-reliefs/:id', description: 'Update tax relief' },
        { method: 'DELETE', path: '/api/v1/payroll/tax-reliefs/:id', description: 'Deactivate tax relief' },
        { method: 'POST', path: '/api/v1/payroll/deduction-definitions', description: 'Create dynamic deduction definition' },
        { method: 'GET', path: '/api/v1/payroll/deduction-definitions', description: 'Get deduction definitions (use ?activeOnly=false for all)' },
        { method: 'GET', path: '/api/v1/payroll/deduction-definitions/:id', description: 'Get deduction definition by ID' },
        { method: 'PUT', path: '/api/v1/payroll/deduction-definitions/:id', description: 'Update deduction definition' },
        { method: 'DELETE', path: '/api/v1/payroll/deduction-definitions/:id', description: 'Deactivate deduction definition' },
        { method: 'POST', path: '/api/v1/payroll/other-deductions', description: 'Create employee other deduction using a dynamic definition or free-form type' },
        { method: 'GET', path: '/api/v1/payroll/other-deductions', description: 'Get employee deductions (use ?activeOnly=false for all)' },
        { method: 'GET', path: '/api/v1/payroll/other-deductions/employee/:employeeid', description: 'Get all deductions for an employee' },
        { method: 'GET', path: '/api/v1/payroll/other-deductions/:id', description: 'Get other deduction by ID' },
        { method: 'GET', path: '/api/v1/payroll/deductions/other/:id/ledger', description: 'Get repayment ledger for an employee deduction' },
        { method: 'PUT', path: '/api/v1/payroll/other-deductions/:id', description: 'Update other deduction' },
        { method: 'DELETE', path: '/api/v1/payroll/other-deductions/:id', description: 'Deactivate other deduction' },
        { method: 'POST', path: '/api/v1/payroll/other-deductions/:id/approve', description: 'Approve other deduction' },
        { method: 'POST', path: '/api/v1/payroll/other-deductions/:id/loan-adjustment', description: 'Create audited loan balance adjustment entry' },
        // Payroll period endpoints
        { method: 'POST', path: '/api/v1/payroll/periods', description: 'Create payroll period' },
        { method: 'POST', path: '/api/v1/payroll/periods/create-next', description: 'Create next payroll period from latest period without providing dates' },
        { method: 'GET', path: '/api/v1/payroll/periods', description: 'Get all periods' },
        { method: 'GET', path: '/api/v1/payroll/periods/:id', description: 'Get period by ID' },
        { method: 'GET', path: '/api/v1/payroll/periods/:id/status', description: 'Get period status' },
        { method: 'GET', path: '/api/v1/payroll/periods/:id/transactions', description: 'Get period transactions' },
        { method: 'POST', path: '/api/v1/payroll/periods/:id/process', description: 'Process payroll' },
        { method: 'POST', path: '/api/v1/payroll/periods/:id/approve', description: 'Approve payroll' },
        { method: 'POST', path: '/api/v1/payroll/periods/:id/lock', description: 'Lock payroll' },
        { method: 'POST', path: '/api/v1/payroll/periods/:id/mark-paid', description: 'Mark payroll as paid' },
        { method: 'POST', path: '/api/v1/payroll/periods/:id/recalculate', description: 'Recalculate employee' },
        { method: 'POST', path: '/api/v1/payroll/periods/:id/recalculate-period', description: 'Recalculate all employees in payroll period' },
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
exports.default = payrollRouter;

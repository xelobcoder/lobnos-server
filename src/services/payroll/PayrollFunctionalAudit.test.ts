import { afterEach, describe, expect, it, vi } from "vitest";
import { accountingSqlDatabase } from "../../testSupport/accountingSqlDatabase";
import { AttendanceRepository } from "../../models/payroll/AttendanceRepository";
vi.mock("../../database/KnexConnections", () => ({
     default: async () => {
          throw new Error("Live database access is forbidden in this test");
     },
}));
import { PayrollCalculationService } from "./PayrollCalculationService";
import { CompensationRepository } from "../../models/payroll/CompensationRepository";
import { GhanaPayrollSetupService } from "./GhanaPayrollSetupService";

afterEach(() => vi.restoreAllMocks());
describe("payroll functional audit regressions", () => {
     it("uses period-effective pay on the legacy path and reconciles the final loan installment", async () => {
          vi.spyOn(GhanaPayrollSetupService.prototype,'calculate').mockResolvedValue(null);
          const service:any = new PayrollCalculationService(7);
          const periodPay=vi.fn().mockResolvedValue({compensation_type:'salary',basic_salary:1000});
          const currentPay=vi.fn().mockRejectedValue(new Error('Current salary must not be used'));
          service.compensationRepo={getForPayrollPeriod:periodPay,getActiveByEmployeeId:currentPay};
          service.attendanceRepo={getAttendanceSummary:async()=>({present_days:20,absent_days:0,total_hours:160,regular_hours:160,overtime_hours:0})};
          service.allowanceRepo={getApplicableByEmployeeId:async()=>[]};
          service.bonusRepo={getApprovedForDateRange:async()=>[]};
          service.deductionDefinitionRepo={getApplicableDefinitions:async()=>[]};
          service.deductionRepo={getApplicableByEmployeeId:async()=>[{id:1,deduction_name:'Loan',amount:100,remaining_balance:25.35}]};
          service.taxService={calculateIncomeTax:async()=>({taxable_income:1000,income_tax:50,effective_tax_rate:5,tax_breakdown:[]})};
          const result=await service.calculateEmployeePayroll({employeeid:1,payroll_period_id:4,period_start_date:'2026-08-01',period_end_date:'2026-08-31'});
          expect(periodPay).toHaveBeenCalledWith(1,'2026-08-01','2026-08-31');expect(currentPay).not.toHaveBeenCalled();
          expect(result).toMatchObject({gross_salary:1000,total_deductions:75.35,net_salary:924.65});
          expect(Math.round((result.net_salary+result.total_deductions)*100)).toBe(result.gross_salary*100);
          expect(result.other_deductions_detail.find((row:any)=>row.id===1).amount).toBe(25.35);
     });
     it("caps final installments, skips cleared balances and retains uncapped recurring deductions", async () => {
          const service: any = new PayrollCalculationService(7);
          service.deductionRepo = {getApplicableByEmployeeId: async () => [
               {id:1, deduction_name:'Loan', amount:100, remaining_balance:25.35},
               {id:2, deduction_name:'Cleared', amount:100, remaining_balance:0},
               {id:3, deduction_name:'Union', amount:10, remaining_balance:null},
          ]};
          const result = await service.calculateOtherDeductions(1,'2026-10-01','2026-10-31');
          expect(result.total_other_deductions).toBe(35.35);
          expect(result.other_deductions_detail.map((row:any)=>row.amount)).toEqual([25.35,10]);
     });
     it("selects historical compensation and refuses a period containing an unclosed salary change", async () => {
          const {db} = accountingSqlDatabase();
          try {
               await db.schema.createTable('payroll_employee_compensation',t=>{
                    t.integer('employeeid');t.boolean('is_active');t.string('effective_from');t.string('effective_to');t.decimal('basic_salary');
               });
               await db('payroll_employee_compensation').insert([
                    {employeeid:1,is_active:false,effective_from:'2026-09-01',effective_to:'2026-09-30',basic_salary:2000},
                    {employeeid:1,is_active:true,effective_from:'2026-10-01',basic_salary:3000},
               ]);
               const repo = new CompensationRepository(7,db);
               await db('payroll_employee_compensation').insert(Array.from({length:12},(_,i)=>({
                    employeeid:i+2,is_active:true,effective_from:'2026-09-01',basic_salary:1000,
               })));
               expect(await repo.getPayrollCandidates('2026-09-01','2026-09-30')).toHaveLength(13);
               expect(await repo.getPayrollCandidates('2026-08-01','2026-08-31')).toEqual([]);
               expect((await repo.getForPayrollPeriod(1,'2026-09-01','2026-09-30'))?.basic_salary).toBe(2000);
               expect(await repo.getForPayrollPeriod(1,'2026-09-15','2026-10-15')).toBeUndefined();
               await db('payroll_employee_compensation').insert({employeeid:1,is_active:true,effective_from:'2026-10-15',basic_salary:3500});
               expect(await repo.getForPayrollPeriod(1,'2026-10-01','2026-10-31')).toBeUndefined();
               expect((await repo.getForPayrollPeriod(1,'2026-10-15','2026-10-31'))?.basic_salary).toBe(3500);
          } finally { await db.destroy(); }
     });
     it("rejects impossible attendance hours before any database call", async () => {
          const repo = new AttendanceRepository(7);
          const record:any = {employeeid:1,attendance_date:'2026-10-01',clock_in:'08:00',clock_out:'09:00',total_hours:1,
               overtime_hours:2,overtime_approved:false,late_minutes:0,status:'present',shift_type:'regular',work_location:'on-site'};
          await expect(repo.create(record)).rejects.toThrow('Overtime cannot exceed');
          await expect(repo.create({...record,status:'absent',overtime_hours:0})).rejects.toThrow('Absent attendance');
     });
     it("pays ten hours with two overtime hours once, rather than paying twelve hours", async () => {
          const service: any = new PayrollCalculationService(7);
          const earnings = await service.calculateEarnings(
               { compensation_type: "hourly", hourly_rate: 10, overtime_rate_multiplier: 1.5 },
               10,
               2,
               1,
               1,
          );
          expect(earnings).toMatchObject({ hourly_earnings: 80, overtime_earnings: 30 });
          expect(earnings.hourly_earnings + earnings.overtime_earnings).toBe(110);
     });
     it("preserves salary overtime and ordinary hourly earnings", async () => {
          const service: any = new PayrollCalculationService(7);
          expect(
               await service.calculateEarnings({ compensation_type: "hourly", hourly_rate: 10 }, 8, 0, 1, 1),
          ).toMatchObject({ hourly_earnings: 80, overtime_earnings: 0 });
          expect(
               await service.calculateEarnings(
                    { compensation_type: "salary", basic_salary: 3000, hourly_rate: 10 },
                    10,
                    2,
                    1,
                    1,
               ),
          ).toMatchObject({ basic_salary: 3000, overtime_earnings: 30 });
     });
     it("includes approved overtime only and counts the actual half_day status", async () => {
          const { db } = accountingSqlDatabase();
          try {
               await db.schema.createTable("payroll_employee_attendance", (t) => {
                    t.integer("employeeid");
                    t.string("attendance_date");
                    t.string("status");
                    t.decimal("total_hours");
                    t.decimal("overtime_hours");
                    t.boolean("overtime_approved");
               });
               await db("payroll_employee_attendance").insert([
                    {
                         employeeid: 1,
                         attendance_date: "2026-10-01",
                         status: "present",
                         total_hours: 10,
                         overtime_hours: 2,
                         overtime_approved: true,
                    },
                    {
                         employeeid: 1,
                         attendance_date: "2026-10-02",
                         status: "present",
                         total_hours: 10,
                         overtime_hours: 2,
                         overtime_approved: false,
                    },
                    {
                         employeeid: 1,
                         attendance_date: "2026-10-03",
                         status: "half_day",
                         total_hours: 4,
                         overtime_hours: 0,
                         overtime_approved: false,
                    },
                    {
                         employeeid: 2,
                         attendance_date: "2026-10-01",
                         status: "present",
                         total_hours: 10,
                         overtime_hours: 2,
                         overtime_approved: true,
                    },
               ]);
               const summary = await new AttendanceRepository(7, db).getAttendanceSummary(
                    1,
                    "2026-10-01",
                    "2026-10-31",
               );
               expect(summary).toMatchObject({ total_hours: 24, regular_hours: 20, overtime_hours: 2, half_days: 1 });
               const earnings = await (new PayrollCalculationService(7) as any).calculateEarnings(
                    { compensation_type: "hourly", hourly_rate: 10 },
                    summary.regular_hours + summary.overtime_hours,
                    summary.overtime_hours,
                    1,
                    1,
               );
               expect(earnings).toMatchObject({ hourly_earnings: 200, overtime_earnings: 30 });
          } finally {
               await db.destroy();
          }
     });
});

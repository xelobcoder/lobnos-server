import { describe, expect, it } from "vitest";
import { payrollYearToDate } from "./PayrollYearToDate";
describe("paid payroll YTD reporting contract", () => {
     it("reconciles paid earnings, actual pensions and deductions without deducting employer contributions", () => {
          const row = {
               payroll_period_id: 1,
               period_name: "October",
               gross_salary: 3000,
               net_salary: 2400,
               income_tax: 400,
               employee_ssnit: 165,
               employer_ssnit: 390,
               total_deductions: 600,
               employer_cost: 3390,
          };
          const result = payrollYearToDate(1, 2026, [row, { ...row, payroll_period_id: 2, period_name: "November" }]);
          expect(result).toMatchObject({
               ytd_gross: 6000,
               ytd_net: 4800,
               ytd_tax: 800,
               ytd_ssnit: 330,
               total_gross_salary: 6000,
               total_net_salary: 4800,
               total_ssnit_employee: 330,
               total_ssnit_employer: 780,
               total_other_deductions: 70,
               total_deductions: 1200,
               number_of_periods: 2,
               employer_cost: 6780,
          });
          expect(
               result.total_gross_salary -
                    result.total_tax -
                    result.total_ssnit_employee -
                    result.total_other_deductions,
          ).toBe(result.total_net_salary);
          expect(result.periods).toHaveLength(2);
     });
     it("returns finite zeros and an empty period list when there is no paid payroll", () => {
          expect(payrollYearToDate(1, 2026, [])).toMatchObject({
               ytd_gross: 0,
               total_ssnit_employee: 0,
               number_of_periods: 0,
               periods: [],
          });
     });
});

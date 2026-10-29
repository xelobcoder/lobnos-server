import Decimal from 'decimal.js';
import { money } from './GhanaPayrollRules';

/** Aggregate paid transaction snapshots, never today's compensation or tax rates. */
export function payrollYearToDate(employeeid: number, year: number, rows: any[]) {
     const sum = (field: string) => money(rows.reduce((value, row) => value.plus(Number(row[field]) || 0), new Decimal(0)));
     const gross = sum('gross_salary'), net = sum('net_salary'), tax = sum('income_tax');
     const employeePension = sum('employee_ssnit'), employerPension = sum('employer_ssnit');
     const deductions = sum('total_deductions');
     return {
          employee_id: employeeid, year,
          ytd_gross: gross, ytd_net: net, ytd_tax: tax, ytd_ssnit: employeePension,
          total_gross_salary: gross, total_net_salary: net, total_tax: tax,
          total_ssnit_employee: employeePension, total_ssnit_employer: employerPension,
          // Includes voluntary deductions such as employee Tier 3, but never employer costs.
          total_other_deductions: money(new Decimal(deductions).minus(tax).minus(employeePension)),
          total_deductions: deductions, employer_cost: sum('employer_cost'),
          number_of_periods: new Set(rows.map(row => row.payroll_period_id)).size,
          periods: rows.map(row => ({ period_name: row.period_name, gross_salary: Number(row.gross_salary) || 0,
               tax_amount: Number(row.income_tax) || 0, ssnit_employee: Number(row.employee_ssnit) || 0,
               net_salary: Number(row.net_salary) || 0 }))
     };
}

import type { IPayrollProcessingResult } from "./PayrollProcessingService";

export function payrollProcessingOutcome(result: IPayrollProcessingResult) {
     const failed = result.errors.length > 0;
     const complete = !failed && result.total_employees_processed > 0 && result.period_status === "calculated";
     return {
          complete,
          status: complete ? "success" : failed && result.total_employees_processed > 0 ? "partial" : "error",
          message: complete
               ? `Payroll processed successfully for ${result.total_employees_processed} employees`
               : result.total_employees_processed > 0
                 ? `${result.total_employees_processed} employees processed; ${result.errors.length} need correction. Payroll remains draft.`
                 : "No employees were processed. Review the employee errors and compensation dates before retrying.",
     };
}

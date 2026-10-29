import Decimal from "decimal.js";
import { GhanaPayrollSetupService } from "./GhanaPayrollSetupService";
import { money } from "./GhanaPayrollRules";
import { CompensationRepository, ICompensation } from "../../models/payroll/CompensationRepository";
import { AttendanceRepository } from "../../models/payroll/AttendanceRepository";
import { AllowanceRepository, BonusRepository } from "../../models/payroll/AllowanceBonusRepository";
import { DeductionDefinitionRepository } from "../../models/payroll/DeductionDefinitionRepository";
import { OtherDeductionRepository } from "../../models/payroll/DeductionRepository";
import { TaxCalculationService } from "./TaxCalculationService";

export interface IPayrollCalculationInput {
     employeeid: number;
     payroll_period_id: number;
     period_start_date: string;
     period_end_date: string;
}

export interface IPayrollCalculationResult {
     employeeid: number;
     payroll_period_id: number;

     // Earnings
     basic_salary: number;
     hourly_earnings: number;
     overtime_earnings: number;
     commission_earnings: number;
     total_allowances: number;
     total_bonuses: number;
     gross_salary: number;

     // Deductions
     income_tax: number;
     total_other_deductions: number;
     total_deductions: number;

     // Final amounts
     net_salary: number;
     employer_cost: number;

     // Attendance summary
     days_worked: number;
     hours_worked: number;
     overtime_hours: number;
     days_absent: number;
     days_leave: number;

     // Detailed breakdowns (JSON)
     allowances_detail: any;
     bonuses_detail: any;
     other_deductions_detail: any;
}

export class PayrollCalculationService {
     private compensationRepo: CompensationRepository;
     private attendanceRepo: AttendanceRepository;
     private allowanceRepo: AllowanceRepository;
     private bonusRepo: BonusRepository;
     private deductionDefinitionRepo: DeductionDefinitionRepository;
     private deductionRepo: OtherDeductionRepository;
     private taxService: TaxCalculationService;

     constructor(private tenantId: number) {
          this.compensationRepo = new CompensationRepository(tenantId);
          this.attendanceRepo = new AttendanceRepository(tenantId);
          this.allowanceRepo = new AllowanceRepository(tenantId);
          this.bonusRepo = new BonusRepository(tenantId);
          this.deductionDefinitionRepo = new DeductionDefinitionRepository(tenantId);
          this.deductionRepo = new OtherDeductionRepository(tenantId);
          this.taxService = new TaxCalculationService(tenantId);
     }

     /**
      * Calculate full payroll for an employee for a given period
      */
     async calculateEmployeePayroll(input: IPayrollCalculationInput): Promise<IPayrollCalculationResult> {
          const { employeeid, payroll_period_id, period_start_date, period_end_date } = input;

          const ghanaService = new GhanaPayrollSetupService(this.tenantId);
          const compensation = await this.compensationRepo.getForPayrollPeriod(employeeid, period_start_date, period_end_date);
          if (!compensation) {
               throw new Error(
                    `No compensation covers the full payroll period for employee ${employeeid}. Review effective dates and mid-month salary changes.`,
               );
          }

          const attendanceSummary = await this.attendanceRepo.getAttendanceSummary(
               employeeid,
               period_start_date,
               period_end_date,
          );

          const earnings = await this.calculateEarnings(
               compensation,
               attendanceSummary.regular_hours === undefined
                    ? attendanceSummary.total_hours
                    : attendanceSummary.regular_hours + attendanceSummary.overtime_hours,
               attendanceSummary.overtime_hours,
               employeeid,
               payroll_period_id,
          );

          // Calculate allowances
          const allowanceResult = await this.calculateAllowances(
               employeeid,
               earnings.basic_salary,
               period_start_date,
               period_end_date,
          );

          // Calculate bonuses
          const bonusResult = await this.calculateBonuses(employeeid, period_start_date, period_end_date);

          // Calculate gross salary
          const grossSalary =
               earnings.basic_salary +
               earnings.hourly_earnings +
               earnings.overtime_earnings +
               earnings.commission_earnings +
               allowanceResult.total_allowances +
               bonusResult.total_bonuses;

          // Calculate statutory deductions
          const definitionDeductions = await this.calculateDefinitionDeductions(employeeid, grossSalary);

          const otherDeductionResult = await this.calculateOtherDeductions(
               employeeid,
               period_start_date,
               period_end_date,
          );
          const ghana = await ghanaService.calculate({
               ...input,
               compensation,
               basic: earnings.basic_salary,
               regularTaxable: money(
                    new Decimal(earnings.basic_salary)
                         .plus(earnings.hourly_earnings)
                         .plus(earnings.commission_earnings)
                         .plus(
                              allowanceResult.allowances_detail
                                   .filter((row) => row.is_taxable)
                                   .reduce((sum, row) => sum + Number(row.amount), 0),
                         ),
               ),
               bonus: money(
                    bonusResult.bonuses_detail
                         .filter((row) => row.is_taxable)
                         .reduce((sum, row) => sum + Number(row.amount), 0),
               ),
               overtime: earnings.overtime_earnings,
               gross: grossSalary,
               definitionDetails: definitionDeductions.other_deductions_detail,
               otherDetails: otherDeductionResult.other_deductions_detail,
          });
          if (ghana) {
               const total = money(
                    new Decimal(ghana.paye)
                         .plus(ghana.employeePension)
                         .plus(ghana.tier3Employee)
                         .plus(ghana.otherDeductions),
               );
               const net = money(new Decimal(grossSalary).minus(total));
               if (net < 0)
                    throw new Error("Employee deductions exceed gross pay. Review deductions before processing.");
               return {
                    employeeid,
                    payroll_period_id,
                    ...earnings,
                    total_allowances: allowanceResult.total_allowances,
                    total_bonuses: bonusResult.total_bonuses,
                    gross_salary: money(grossSalary),
                    income_tax: ghana.paye,
                    total_other_deductions: ghana.otherDeductions,
                    total_deductions: total,
                    net_salary: net,
                    employer_cost: money(
                         new Decimal(grossSalary).plus(ghana.employerPension).plus(ghana.tier3Employer),
                    ),
                    days_worked: attendanceSummary.present_days,
                    hours_worked: attendanceSummary.total_hours,
                    overtime_hours: attendanceSummary.overtime_hours,
                    days_absent: attendanceSummary.absent_days,
                    days_leave: 0,
                    allowances_detail: allowanceResult.allowances_detail,
                    bonuses_detail: bonusResult.bonuses_detail,
                    other_deductions_detail: [
                         {
                              type: "income_tax",
                              name: "PAYE (Ghana GRA)",
                              amount: ghana.paye,
                              source: "ghana",
                              taxable_income: ghana.chargeable,
                              tax_relief_total: ghana.approvedRelief,
                              tax_breakdown: ghana.taxBreakdown,
                         },
                         {
                              type: "ssnit_employee",
                              name: "Employee mandatory pension",
                              amount: ghana.employeePension,
                              source: "ghana",
                              is_statutory: true,
                         },
                         ...(ghana.tier3Employee
                              ? [
                                     {
                                          type: "tier3_employee",
                                          name: "Employee Tier 3",
                                          amount: ghana.tier3Employee,
                                          source: "ghana",
                                          is_statutory: false,
                                     },
                                ]
                              : []),
                         ...ghana.keptDefinitions,
                         ...ghana.keptOther,
                         {
                              type: "ghana_compliance",
                              name: "Ghana calculation record",
                              amount: 0,
                              source: "ghana",
                              ...Object.fromEntries(
                                   Object.entries(ghana).filter(
                                        ([key]) => !["keptDefinitions", "keptOther"].includes(key),
                                   ),
                              ),
                         },
                    ],
               };
          }
          // Calculate income tax
          const dependents = 0;
          const isTaxExempt = false;

          const taxComputation = isTaxExempt
               ? {
                      taxable_income: grossSalary,
                      income_tax: 0,
                      effective_tax_rate: 0,
                      tax_relief_total: 0,
                      tax_relief_details: [] as any[],
                      tax_breakdown: [] as Array<{ band: string; amount: number; tax: number }>,
                 }
               : await this.taxService.calculateIncomeTax(grossSalary, dependents);

          const incomeTax = taxComputation.income_tax;
          const taxReliefTotal = Number((taxComputation as any).tax_relief_total) || 0;
          const taxReliefDetails = Array.isArray((taxComputation as any).tax_relief_details)
               ? (taxComputation as any).tax_relief_details
               : [];

          // Calculate total deductions
          const totalDeductions =
               incomeTax + definitionDeductions.total_other_deductions + otherDeductionResult.total_other_deductions;

          // Calculate net salary
          const netSalary = grossSalary - totalDeductions;
          if (netSalary < 0)
               throw new Error("Employee deductions exceed gross pay. Review deductions before processing.");

          // Calculate employer cost
          const employerCost = grossSalary;

          return {
               employeeid,
               payroll_period_id,
               basic_salary: earnings.basic_salary,
               hourly_earnings: earnings.hourly_earnings,
               overtime_earnings: earnings.overtime_earnings,
               commission_earnings: earnings.commission_earnings,
               total_allowances: allowanceResult.total_allowances,
               total_bonuses: bonusResult.total_bonuses,
               gross_salary: Math.round(grossSalary * 100) / 100,
               income_tax: Math.round(incomeTax * 100) / 100,
               total_other_deductions:
                    Math.round(
                         (definitionDeductions.total_other_deductions + otherDeductionResult.total_other_deductions) *
                              100,
                    ) / 100,
               total_deductions: Math.round(totalDeductions * 100) / 100,
               net_salary: Math.round(netSalary * 100) / 100,
               employer_cost: Math.round(employerCost * 100) / 100,
               days_worked: attendanceSummary.present_days,
               hours_worked: attendanceSummary.total_hours,
               overtime_hours: attendanceSummary.overtime_hours,
               days_absent: attendanceSummary.absent_days,
               days_leave: 0,
               allowances_detail: allowanceResult.allowances_detail,
               bonuses_detail: bonusResult.bonuses_detail,
               other_deductions_detail: [
                    {
                         type: "income_tax",
                         name: "Income Tax",
                         amount: Math.round(incomeTax * 100) / 100,
                         source: "tax_configuration",
                         taxable_income: Math.round(taxComputation.taxable_income * 100) / 100,
                         effective_tax_rate: Math.round(taxComputation.effective_tax_rate * 100) / 100,
                         tax_relief_total: Math.round(taxReliefTotal * 100) / 100,
                         tax_relief_details: taxReliefDetails,
                         tax_breakdown: taxComputation.tax_breakdown,
                    },
                    ...definitionDeductions.other_deductions_detail,
                    ...otherDeductionResult.other_deductions_detail,
               ],
          };
     }

     private async calculateDefinitionDeductions(
          employeeid: number,
          grossSalary: number,
     ): Promise<{
          total_other_deductions: number;
          other_deductions_detail: any[];
     }> {
          const definitions = await this.deductionDefinitionRepo.getApplicableDefinitions(employeeid);

          const result = {
               total_other_deductions: 0,
               other_deductions_detail: [] as any[],
          };

          for (const definition of definitions) {
               const configuredAmount = Number(definition.default_amount || 0);
               const amount =
                    definition.default_calculation_method === "percentage_of_gross"
                         ? Math.round(grossSalary * (configuredAmount / 100) * 100) / 100
                         : Math.round(configuredAmount * 100) / 100;

               result.total_other_deductions += amount;
               result.other_deductions_detail.push({
                    definition_id: definition.id,
                    type: definition.deduction_code,
                    name: definition.deduction_name,
                    amount,
                    source: "definition",
                    calculation_method: definition.default_calculation_method,
                    is_statutory: definition.is_statutory,
               });
          }

          return {
               total_other_deductions: Math.round(result.total_other_deductions * 100) / 100,
               other_deductions_detail: result.other_deductions_detail,
          };
     }

     /**
      * Calculate earnings based on compensation type
      */
     private async calculateEarnings(
          compensation: ICompensation,
          hoursWorked: number,
          overtimeHours: number,
          employeeid: number,
          payroll_period_id: number,
     ): Promise<{
          basic_salary: number;
          hourly_earnings: number;
          overtime_earnings: number;
          commission_earnings: number;
     }> {
          let basicSalary = 0;
          let hourlyEarnings = 0;
          let overtimeEarnings = 0;
          let commissionEarnings = 0;

          switch (compensation.compensation_type) {
               case "salary":
                    basicSalary = compensation.basic_salary || 0;

                    // Calculate overtime if applicable
                    if (overtimeHours > 0 && compensation.hourly_rate) {
                         const overtimeRate = compensation.hourly_rate * (compensation.overtime_rate_multiplier || 1.5);
                         overtimeEarnings = overtimeHours * overtimeRate;
                    }
                    break;

               case "hourly":
                    const hourlyRate = compensation.hourly_rate || 0;
                    // Total attendance includes overtime; pay each hour once.
                    hourlyEarnings = Math.max(0, hoursWorked - overtimeHours) * hourlyRate;

                    // Calculate overtime
                    if (overtimeHours > 0) {
                         const overtimeRate = hourlyRate * (compensation.overtime_rate_multiplier || 1.5);
                         overtimeEarnings = overtimeHours * overtimeRate;
                    }
                    break;

               case "commission":
                    // TODO: Calculate commission based on sales/performance
                    // This would need integration with sales/billing data
                    commissionEarnings = 0;
                    break;

               case "hybrid":
                    // Combination of salary and commission
                    basicSalary = compensation.basic_salary || 0;
                    // TODO: Add commission calculation
                    commissionEarnings = 0;
                    break;
          }

          return {
               basic_salary: Math.round(basicSalary * 100) / 100,
               hourly_earnings: Math.round(hourlyEarnings * 100) / 100,
               overtime_earnings: Math.round(overtimeEarnings * 100) / 100,
               commission_earnings: Math.round(commissionEarnings * 100) / 100,
          };
     }

     /**
      * Calculate total allowances for employee
      */
     private async calculateAllowances(
          employeeid: number,
          basicSalary: number,
          periodStartDate: string,
          periodEndDate: string,
     ): Promise<{
          total_allowances: number;
          allowances_detail: any[];
     }> {
          const allowances = await this.allowanceRepo.getApplicableByEmployeeId(
               employeeid,
               periodStartDate,
               periodEndDate,
          );

          let totalAllowances = 0;
          const allowancesDetail = [];

          for (const allowance of allowances) {
               let amount = 0;
               const allowanceAmount = Number(allowance.amount) || 0;

               if (allowance.calculation_method === "fixed") {
                    amount = allowanceAmount;
               } else if (allowance.calculation_method === "percentage_of_basic") {
                    amount = (basicSalary * (allowance.percentage || 0)) / 100;
               } else if (allowance.calculation_method === "variable") {
                    // Variable allowances use the amount field directly
                    amount = allowanceAmount;
               }

               totalAllowances += amount;
               allowancesDetail.push({
                    type: allowance.allowance_type,
                    amount: Math.round(amount * 100) / 100,
                    is_taxable: allowance.is_taxable,
               });
          }

          return {
               total_allowances: Math.round(totalAllowances * 100) / 100,
               allowances_detail: allowancesDetail,
          };
     }

     /**
      * Calculate bonuses for payroll period
      */
     private async calculateBonuses(
          employeeid: number,
          periodStartDate: string,
          periodEndDate: string,
     ): Promise<{
          total_bonuses: number;
          bonuses_detail: any[];
     }> {
          const bonuses = await this.bonusRepo.getApprovedForDateRange(employeeid, periodStartDate, periodEndDate);

          let totalBonuses = 0;
          const bonusesDetail = [];

          for (const bonus of bonuses) {
               totalBonuses += Number(bonus.amount) || 0;
               bonusesDetail.push({
                    type: bonus.bonus_type,
                    amount: Number(bonus.amount) || 0,
                    is_taxable: bonus.is_taxable,
               });
          }

          return {
               total_bonuses: Math.round(totalBonuses * 100) / 100,
               bonuses_detail: bonusesDetail,
          };
     }

     /**
      * Calculate other deductions
      */
     private async calculateOtherDeductions(
          employeeid: number,
          periodStartDate: string,
          periodEndDate: string,
     ): Promise<{
          total_other_deductions: number;
          other_deductions_detail: any[];
     }> {
          const deductions = await this.deductionRepo.getApplicableByEmployeeId(
               employeeid,
               periodStartDate,
               periodEndDate,
          );

          let totalDeductions = 0;
          const deductionsDetail = [];

          for (const deduction of deductions) {
               // The final installment cannot exceed the outstanding balance.
               const configured = Number(deduction.amount) || 0;
               const balance = deduction.remaining_balance ?? deduction.total_amount;
               const amount = money(balance == null ? configured : Math.min(configured, Number(balance)));
               if (!Number.isFinite(amount) || amount < 0) throw new Error(`Review the balance for deduction ${deduction.deduction_name}.`);
               if (amount === 0) continue;
               const startDateValue: any = deduction.start_date;
               const endDateValue: any = deduction.end_date;
               totalDeductions += amount;
               deductionsDetail.push({
                    id: deduction.id ? Number(deduction.id) : undefined,
                    type: deduction.deduction_type,
                    name: deduction.deduction_name,
                    amount: Math.round(amount * 100) / 100,
                    priority: Number(deduction.deduction_priority) || 0,
                    remaining_balance: Math.round((Number(deduction.remaining_balance) || 0) * 100) / 100,
                    is_recurring: Boolean(deduction.is_recurring),
                    frequency: deduction.frequency,
                    start_date:
                         startDateValue instanceof Date
                              ? startDateValue.toISOString().split("T")[0]
                              : String(startDateValue),
                    end_date: endDateValue
                         ? endDateValue instanceof Date
                              ? endDateValue.toISOString().split("T")[0]
                              : String(endDateValue)
                         : undefined,
                    deduction_definition_id: deduction.deduction_definition_id
                         ? Number(deduction.deduction_definition_id)
                         : undefined,
               });
          }

          return {
               total_other_deductions: Math.round(totalDeductions * 100) / 100,
               other_deductions_detail: deductionsDetail,
          };
     }

     /**
      * Calculate payroll for multiple employees
      */
     async calculateBulkPayroll(inputs: IPayrollCalculationInput[]): Promise<IPayrollCalculationResult[]> {
          const results: IPayrollCalculationResult[] = [];

          for (const input of inputs) {
               try {
                    const result = await this.calculateEmployeePayroll(input);
                    results.push(result);
               } catch (error) {
                    console.error(`Error calculating payroll for employee ${input.employeeid}:`, error);
               }
          }

          return results;
     }
}

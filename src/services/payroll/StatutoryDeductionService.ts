import { TaxConfigurationRepository } from '../../models/payroll/TaxConfigurationRepository';
import { StatutoryDeductionRepository, IStatutoryDeduction } from '../../models/payroll/DeductionRepository';

export interface IStatutoryDeductionResult {
     employee_ssnit: number;
     employer_ssnit: number;
     employee_tier3: number;
     employer_tier3: number;
     nhis: number;
     total_employee_statutory: number;
     total_employer_statutory: number;
}

export class StatutoryDeductionService {
     private taxConfigRepo: TaxConfigurationRepository;
     private statutoryRepo: StatutoryDeductionRepository;

     constructor(private tenantId: number) {
          this.taxConfigRepo = new TaxConfigurationRepository(tenantId);
          this.statutoryRepo = new StatutoryDeductionRepository(tenantId);
     }

     /**
      * Calculate all statutory deductions for an employee
      * Auto-creates statutory deduction record with defaults if not exists
      */
     async calculateStatutoryDeductions(
          employeeid: number,
          basicSalary: number
     ): Promise<IStatutoryDeductionResult> {
          const taxConfig = await this.taxConfigRepo.getActive();
          if (!taxConfig) {
               throw new Error('No active tax configuration found');
          }

          // Get or create statutory deduction record
          let employeeStatutory = await this.statutoryRepo.getByEmployeeId(employeeid);

          if (!employeeStatutory) {
               // Auto-create with default settings
               employeeStatutory = await this.createDefaultStatutoryDeduction(employeeid);
          }

          // Calculate SSNIT (Social Security)
          let employeeSSNIT = 0;
          let employerSSNIT = 0;

          if (employeeStatutory.ssnit_active) {
               const ssnitRate = employeeStatutory.ssnit_employee_rate || taxConfig.employee_ssnit_rate;
               const employerSSNITRate = taxConfig.employer_ssnit_rate;

               // Apply ceiling if configured
               const ssnitBase = taxConfig.ssnit_ceiling
                    ? Math.min(basicSalary, taxConfig.ssnit_ceiling)
                    : basicSalary;

               employeeSSNIT = Math.round((ssnitBase * (ssnitRate / 100)) * 100) / 100;
               employerSSNIT = Math.round((ssnitBase * (employerSSNITRate / 100)) * 100) / 100;
          }

          // Calculate Tier 3 Pension (voluntary)
          let employeeTier3 = 0;
          let employerTier3 = 0;

          if (employeeStatutory.tier3_enrolled) {
               const tier3EmployeeRate = employeeStatutory.tier3_employee_rate || taxConfig.tier3_employee_rate;
               const tier3EmployerRate = employeeStatutory.tier3_employer_rate || taxConfig.tier3_employer_rate;

               // Apply ceiling if configured
               const pensionBase = taxConfig.pension_ceiling
                    ? Math.min(basicSalary, taxConfig.pension_ceiling)
                    : basicSalary;

               employeeTier3 = Math.round((pensionBase * (tier3EmployeeRate / 100)) * 100) / 100;
               employerTier3 = Math.round((pensionBase * (tier3EmployerRate / 100)) * 100) / 100;
          }

          // Calculate NHIS (National Health Insurance)
          let nhis = 0;
          if (employeeStatutory.nhis_active) {
               const nhisRate = employeeStatutory.nhis_rate || 2.5;
               nhis = Math.round((basicSalary * (nhisRate / 100)) * 100) / 100;
          }

          return {
               employee_ssnit: employeeSSNIT,
               employer_ssnit: employerSSNIT,
               employee_tier3: employeeTier3,
               employer_tier3: employerTier3,
               nhis: nhis,
               total_employee_statutory: employeeSSNIT + employeeTier3 + nhis,
               total_employer_statutory: employerSSNIT + employerTier3
          };
     }

     /**
      * Auto-create default statutory deduction record for employee
      */
     private async createDefaultStatutoryDeduction(employeeid: number): Promise<IStatutoryDeduction> {
          const defaultDeduction: IStatutoryDeduction = {
               employeeid,
               ssnit_number: null, // Will be assigned later
               ssnit_active: true, // Default: active (mandatory in Ghana)
               ssnit_employee_rate: 5.5, // Standard SSNIT rate
               tier3_enrolled: false, // Default: not enrolled
               tier3_scheme_name: null,
               tier3_scheme_number: null,
               tier3_employee_rate: 5,
               tier3_employer_rate: 5,
               tin_number: null, // Will be assigned later
               tax_exempt: false, // Default: not exempt
               tax_exempt_reason: null,
               dependents_count: 0, // Default: no dependents
               nhis_number: null, // Will be assigned later
               nhis_active: true, // Default: active (mandatory in Ghana)
               nhis_rate: 2.5 // Standard NHIS rate
          };

          try {
               await this.statutoryRepo.create(defaultDeduction);
          } catch (error) {
               // If creation fails (e.g., duplicate), try to get existing
               const existing = await this.statutoryRepo.getByEmployeeId(employeeid);
               if (existing) {
                    return existing;
               }
               throw error;
          }

          return defaultDeduction;
     }

     /**
      * Calculate SSNIT only
      */
     async calculateSSNIT(
          employeeid: number,
          basicSalary: number
     ): Promise<{ employee: number; employer: number }> {
          const taxConfig = await this.taxConfigRepo.getActive();
          if (!taxConfig) {
               throw new Error('No active tax configuration found');
          }

          const employeeStatutory = await this.statutoryRepo.getByEmployeeId(employeeid);

          if (!employeeStatutory?.ssnit_active) {
               return { employee: 0, employer: 0 };
          }

          const ssnitRate = employeeStatutory.ssnit_employee_rate || taxConfig.employee_ssnit_rate;
          const employerSSNITRate = taxConfig.employer_ssnit_rate;

          const ssnitBase = taxConfig.ssnit_ceiling
               ? Math.min(basicSalary, taxConfig.ssnit_ceiling)
               : basicSalary;

          return {
               employee: Math.round((ssnitBase * (ssnitRate / 100)) * 100) / 100,
               employer: Math.round((ssnitBase * (employerSSNITRate / 100)) * 100) / 100
          };
     }

     /**
      * Calculate Tier 3 pension only
      */
     async calculateTier3(
          employeeid: number,
          basicSalary: number
     ): Promise<{ employee: number; employer: number }> {
          const taxConfig = await this.taxConfigRepo.getActive();
          if (!taxConfig) {
               throw new Error('No active tax configuration found');
          }

          const employeeStatutory = await this.statutoryRepo.getByEmployeeId(employeeid);

          if (!employeeStatutory?.tier3_enrolled) {
               return { employee: 0, employer: 0 };
          }

          const tier3EmployeeRate = employeeStatutory.tier3_employee_rate || taxConfig.tier3_employee_rate;
          const tier3EmployerRate = employeeStatutory.tier3_employer_rate || taxConfig.tier3_employer_rate;

          const pensionBase = taxConfig.pension_ceiling
               ? Math.min(basicSalary, taxConfig.pension_ceiling)
               : basicSalary;

          return {
               employee: Math.round((pensionBase * (tier3EmployeeRate / 100)) * 100) / 100,
               employer: Math.round((pensionBase * (tier3EmployerRate / 100)) * 100) / 100
          };
     }

     /**
      * Validate statutory enrollment status
      * Auto-creates statutory record if not exists
      */
     async validateStatutoryEnrollment(employeeid: number): Promise<{
          ssnit_enrolled: boolean;
          ssnit_number?: string;
          tier3_enrolled: boolean;
          tier3_scheme?: string;
          tin_number?: string;
          nhis_enrolled: boolean;
     }> {
          let statutory = await this.statutoryRepo.getByEmployeeId(employeeid);

          if (!statutory) {
               statutory = await this.createDefaultStatutoryDeduction(employeeid);
          }

          return {
               ssnit_enrolled: statutory.ssnit_active,
               ssnit_number: statutory.ssnit_number || undefined,
               tier3_enrolled: statutory.tier3_enrolled,
               tier3_scheme: statutory.tier3_scheme_name || undefined,
               tin_number: statutory.tin_number || undefined,
               nhis_enrolled: statutory.nhis_active
          };
     }

     /**
      * Calculate total employer cost for statutory contributions
      */
     async calculateEmployerStatutoryCost(
          employeeid: number,
          basicSalary: number
     ): Promise<number> {
          const deductions = await this.calculateStatutoryDeductions(employeeid, basicSalary);
          return deductions.total_employer_statutory;
     }

     /**
      * Get employee statutory deduction configuration
      * Auto-creates statutory record if not exists
      */
     async getEmployeeStatutoryConfig(employeeid: number): Promise<IStatutoryDeduction | undefined> {
          let statutory = await this.statutoryRepo.getByEmployeeId(employeeid);

          if (!statutory) {
               statutory = await this.createDefaultStatutoryDeduction(employeeid);
          }

          return statutory;
     }

     /**
      * Check if employee is tax exempt
      * Auto-creates statutory record if not exists
      */
     async isTaxExempt(employeeid: number): Promise<boolean> {
          let statutory = await this.statutoryRepo.getByEmployeeId(employeeid);

          if (!statutory) {
               statutory = await this.createDefaultStatutoryDeduction(employeeid);
          }

          return statutory.tax_exempt;
     }

     /**
      * Get number of dependents for tax calculation
      * Auto-creates statutory record if not exists
      */
     async getDependentsCount(employeeid: number): Promise<number> {
          let statutory = await this.statutoryRepo.getByEmployeeId(employeeid);

          if (!statutory) {
               statutory = await this.createDefaultStatutoryDeduction(employeeid);
          }

          return statutory.dependents_count;
     }
}

import { TaxConfigurationRepository, ITaxConfiguration } from '../../models/payroll/TaxConfigurationRepository';

export interface ITaxBand {
     min: number;
     max: number | null;
     rate: number;
}

export interface ITaxCalculationResult {
     taxable_income: number;
     income_tax: number;
     effective_tax_rate: number;
     tax_breakdown: {
          band: string;
          amount: number;
          tax: number;
     }[];
}

export class TaxCalculationService {
     private taxConfigRepo: TaxConfigurationRepository;

     constructor(private tenantId: number) {
          this.taxConfigRepo = new TaxConfigurationRepository(tenantId);
     }

     /**
      * Calculate income tax based on taxable income and current tax configuration
      */
     async calculateIncomeTax(
          grossIncome: number,
          dependents: number = 0,
          isDisabled: boolean = false
     ): Promise<ITaxCalculationResult> {
          const taxConfig = await this.taxConfigRepo.getActive();

          if (!taxConfig) {
               throw new Error('No active tax configuration found');
          }

          // Calculate total exemptions and reliefs
          const standardExemption = taxConfig.standard_exemption || 0;
          const dependentRelief = (taxConfig.dependent_relief || 0) * dependents;
          const disabilityExemption = isDisabled ? (taxConfig.disability_exemption || 0) : 0;

          const totalReliefs = standardExemption + dependentRelief + disabilityExemption;
          const taxableIncome = Math.max(0, grossIncome - totalReliefs);

          // Parse tax bands from JSON
          const taxBands: ITaxBand[] = typeof taxConfig.tax_bands === 'string'
               ? JSON.parse(taxConfig.tax_bands)
               : taxConfig.tax_bands;

          // Calculate tax using progressive bands
          const taxBreakdown = [];
          let totalTax = 0;

          for (const band of taxBands) {
               if (taxableIncome <= band.min) {
                    break;
               }

               const bandMin = band.min;
               const bandMax = band.max || Infinity;
               const bandRate = band.rate / 100;

               if (taxableIncome > bandMin) {
                    const taxableInBand = Math.min(taxableIncome, bandMax) - bandMin;
                    const taxInBand = taxableInBand * bandRate;
                    totalTax += taxInBand;

                    taxBreakdown.push({
                         band: band.max
                              ? `GHS ${band.min} - GHS ${band.max}`
                              : `Above GHS ${band.min}`,
                         amount: taxableInBand,
                         tax: taxInBand
                    });

                    if (taxableIncome <= bandMax) {
                         break;
                    }
               }
          }

          const effectiveTaxRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;

          return {
               taxable_income: taxableIncome,
               income_tax: Math.round(totalTax * 100) / 100,
               effective_tax_rate: Math.round(effectiveTaxRate * 100) / 100,
               tax_breakdown: taxBreakdown
          };
     }

     /**
      * Calculate monthly tax from annual taxable income
      */
     async calculateMonthlyTax(
          monthlyGrossIncome: number,
          dependents: number = 0,
          isDisabled: boolean = false
     ): Promise<number> {
          // Annualize the income
          const annualIncome = monthlyGrossIncome * 12;

          const taxResult = await this.calculateIncomeTax(annualIncome, dependents, isDisabled);

          // Return monthly tax
          return Math.round((taxResult.income_tax / 12) * 100) / 100;
     }

     /**
      * Calculate tax on bonus using specified method
      */
     async calculateBonusTax(
          bonusAmount: number,
          regularMonthlyIncome: number,
          taxMethod: 'aggregate' | 'separate' | 'bonus_rate',
          dependents: number = 0
     ): Promise<number> {
          const taxConfig = await this.taxConfigRepo.getActive();
          if (!taxConfig) {
               throw new Error('No active tax configuration found');
          }

          switch (taxMethod) {
               case 'aggregate':
                    // Add bonus to regular income and calculate total tax
                    const totalIncome = (regularMonthlyIncome + bonusAmount) * 12;
                    const totalTaxResult = await this.calculateIncomeTax(totalIncome, dependents);

                    const regularIncome = regularMonthlyIncome * 12;
                    const regularTaxResult = await this.calculateIncomeTax(regularIncome, dependents);

                    return Math.round((totalTaxResult.income_tax - regularTaxResult.income_tax) * 100) / 100;

               case 'separate':
                    // Tax bonus at highest marginal rate
                    const taxBands: ITaxBand[] = typeof taxConfig.tax_bands === 'string'
                         ? JSON.parse(taxConfig.tax_bands)
                         : taxConfig.tax_bands;

                    const highestRate = taxBands[taxBands.length - 1].rate / 100;
                    return Math.round(bonusAmount * highestRate * 100) / 100;

               case 'bonus_rate':
                    // Fixed 15% rate for bonuses (common in some jurisdictions)
                    return Math.round(bonusAmount * 0.15 * 100) / 100;

               default:
                    throw new Error(`Unknown tax method: ${taxMethod}`);
          }
     }

     /**
      * Get current tax configuration
      */
     async getTaxConfiguration(): Promise<ITaxConfiguration | undefined> {
          return this.taxConfigRepo.getActive();
     }

     /**
      * Calculate tax relief amounts
      */
     async calculateTaxReliefs(
          dependents: number,
          isDisabled: boolean = false
     ): Promise<{
          standard_exemption: number;
          dependent_relief: number;
          disability_exemption: number;
          total_relief: number;
     }> {
          const taxConfig = await this.taxConfigRepo.getActive();

          if (!taxConfig) {
               throw new Error('No active tax configuration found');
          }

          const standardExemption = taxConfig.standard_exemption || 0;
          const dependentRelief = (taxConfig.dependent_relief || 0) * dependents;
          const disabilityExemption = isDisabled ? (taxConfig.disability_exemption || 0) : 0;

          return {
               standard_exemption: standardExemption,
               dependent_relief: dependentRelief,
               disability_exemption: disabilityExemption,
               total_relief: standardExemption + dependentRelief + disabilityExemption
          };
     }
}

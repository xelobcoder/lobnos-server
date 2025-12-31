"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxCalculationService = void 0;
const TaxConfigurationRepository_1 = require("../../models/payroll/TaxConfigurationRepository");
class TaxCalculationService {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.taxConfigRepo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
    }
    /**
     * Calculate income tax based on taxable income and current tax configuration
     */
    async calculateIncomeTax(grossIncome, dependents = 0, isDisabled = false) {
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
        const taxBands = typeof taxConfig.tax_bands === 'string'
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
    async calculateMonthlyTax(monthlyGrossIncome, dependents = 0, isDisabled = false) {
        // Annualize the income
        const annualIncome = monthlyGrossIncome * 12;
        const taxResult = await this.calculateIncomeTax(annualIncome, dependents, isDisabled);
        // Return monthly tax
        return Math.round((taxResult.income_tax / 12) * 100) / 100;
    }
    /**
     * Calculate tax on bonus using specified method
     */
    async calculateBonusTax(bonusAmount, regularMonthlyIncome, taxMethod, dependents = 0) {
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
                const taxBands = typeof taxConfig.tax_bands === 'string'
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
    async getTaxConfiguration() {
        return this.taxConfigRepo.getActive();
    }
    /**
     * Calculate tax relief amounts
     */
    async calculateTaxReliefs(dependents, isDisabled = false) {
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
exports.TaxCalculationService = TaxCalculationService;

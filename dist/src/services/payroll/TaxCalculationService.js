"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxCalculationService = void 0;
const TaxConfigurationRepository_1 = require("../../models/payroll/TaxConfigurationRepository");
const TaxReliefRepository_1 = require("../../models/payroll/TaxReliefRepository");
class TaxCalculationService {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.taxConfigRepo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        this.taxReliefRepo = new TaxReliefRepository_1.TaxReliefRepository(tenantId);
    }
    roundCurrency(value) {
        return Math.round(value * 100) / 100;
    }
    async calculateConfiguredReliefs(grossIncome, dependents, isDisabled, taxConfigurationId) {
        const reliefs = await this.taxReliefRepo.getActiveByTaxConfigurationId(taxConfigurationId);
        if (!reliefs.length) {
            return {
                configured: false,
                total_relief: 0,
                details: []
            };
        }
        let totalRelief = 0;
        const details = [];
        for (const relief of reliefs) {
            if (relief.requires_disability && !isDisabled) {
                continue;
            }
            let reliefAmount = 0;
            switch (relief.calculation_method) {
                case 'per_dependent':
                    reliefAmount = relief.amount * dependents;
                    break;
                case 'percentage_of_gross':
                    reliefAmount = grossIncome * (relief.amount / 100);
                    break;
                default:
                    reliefAmount = relief.amount;
            }
            reliefAmount = this.roundCurrency(reliefAmount);
            totalRelief += reliefAmount;
            details.push({ relief, amount: reliefAmount });
        }
        return {
            configured: true,
            total_relief: this.roundCurrency(totalRelief),
            details
        };
    }
    /**
     * Calculate income tax based on taxable income and current tax configuration
     */
    async calculateIncomeTax(grossIncome, dependents = 0, isDisabled = false) {
        const taxConfig = await this.taxConfigRepo.getActive();
        if (!taxConfig) {
            throw new Error('No active tax configuration found');
        }
        const configuredReliefs = await this.calculateConfiguredReliefs(grossIncome, dependents, isDisabled, taxConfig.id);
        const totalReliefs = configuredReliefs.total_relief;
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
        const taxResult = await this.calculateIncomeTax(monthlyGrossIncome, dependents, isDisabled);
        return Math.round(taxResult.income_tax * 100) / 100;
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
        const configuredReliefs = await this.calculateConfiguredReliefs(0, dependents, isDisabled, taxConfig.id);
        if (configuredReliefs.configured) {
            const standardExemption = configuredReliefs.details
                .filter((item) => !item.relief.requires_disability && item.relief.calculation_method !== 'per_dependent')
                .reduce((sum, item) => sum + item.amount, 0);
            const dependentRelief = configuredReliefs.details
                .filter((item) => item.relief.calculation_method === 'per_dependent')
                .reduce((sum, item) => sum + item.amount, 0);
            const disabilityExemption = configuredReliefs.details
                .filter((item) => item.relief.requires_disability)
                .reduce((sum, item) => sum + item.amount, 0);
            return {
                standard_exemption: this.roundCurrency(standardExemption),
                dependent_relief: this.roundCurrency(dependentRelief),
                disability_exemption: this.roundCurrency(disabilityExemption),
                total_relief: configuredReliefs.total_relief
            };
        }
        return {
            standard_exemption: 0,
            dependent_relief: 0,
            disability_exemption: 0,
            total_relief: 0
        };
    }
}
exports.TaxCalculationService = TaxCalculationService;

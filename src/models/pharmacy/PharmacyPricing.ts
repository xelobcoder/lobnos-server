import Decimal from 'decimal.js';
import { money } from './PharmacyRules';

export type PharmacyPricingMethod = 'keep' | 'manual' | 'fixed' | 'percentage' | 'margin' | 'increase_fixed' | 'decrease_fixed' | 'increase_percentage' | 'decrease_percentage';
export interface PharmacyPriceChoice {
     method: PharmacyPricingMethod;
     value?: number;
     expectedPrice?: number;
}
export function procurementAmount(value: unknown, label: string): number {
     if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 99999999999.99 || money(value) !== value)
          throw new Error(`Enter a valid ${label} with at most two decimal places`);
     return value;
}
export function priceIncrement(value: unknown): number {
     const increment = procurementAmount(value, 'rounding increment');
     if (increment < 0.01 || increment > 100) throw new Error('Rounding increment must be between 0.01 and 100');
     return increment;
}
export function calculatePharmacyPrice(cost: number, choice: PharmacyPriceChoice, increment = 0.01, currentPrice?: number) {
     if (!Number.isFinite(cost) || cost < 0) throw new Error('Enter a valid base-unit purchase cost');
     priceIncrement(increment);
     if (!choice || !['keep', 'manual', 'fixed', 'percentage', 'margin', 'increase_fixed', 'decrease_fixed', 'increase_percentage', 'decrease_percentage'].includes(choice.method))
          throw new Error('Choose a supported selling-price method');
     if (choice.method === 'keep') return { method: choice.method, cost, price: null, margin: null, increment };
     const value = choice.value;
     if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Enter a non-negative pricing value');
     if (choice.method === 'margin' && value >= 100) throw new Error('Target gross margin must be below 100%');
     let proposed = new Decimal(value);
     if (choice.method === 'fixed') proposed = new Decimal(cost).plus(value);
     if (choice.method === 'percentage') proposed = new Decimal(cost).mul(new Decimal(value).div(100).plus(1));
     if (choice.method === 'margin') proposed = new Decimal(cost).div(new Decimal(1).minus(new Decimal(value).div(100)));
     if (choice.method.startsWith('increase_') || choice.method.startsWith('decrease_')) {
          if (currentPrice === undefined || !Number.isFinite(currentPrice) || currentPrice < 0) throw new Error('The current selling price is required for a selling-price adjustment');
          const change = choice.method.endsWith('_percentage') ? new Decimal(currentPrice).mul(value).div(100) : new Decimal(value);
          proposed = choice.method.startsWith('increase_') ? new Decimal(currentPrice).plus(change) : new Decimal(currentPrice).minus(change);
     }
     const price = proposed.div(increment).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(increment).toDecimalPlaces(2).toNumber();
     procurementAmount(price, 'selling price');
     if (price <= 0) throw new Error('The selling price must be greater than zero');
     return { method: choice.method, value, cost, price, margin: new Decimal(price).minus(cost).div(price).mul(100).toDecimalPlaces(3).toNumber(), increment };
}

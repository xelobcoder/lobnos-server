"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitValidationService = exports.UNIT_VALIDATION_RULES = void 0;
exports.UNIT_VALIDATION_RULES = {
    'pieces': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'boxes': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'bottles': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'packs': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'liters': { unit_category: 'volume', min_value: 0, decimal_places: 2, allow_negative: false },
    'kg': { unit_category: 'weight', min_value: 0, decimal_places: 3, allow_negative: false },
    'mg': { unit_category: 'weight', min_value: 0, decimal_places: 0, allow_negative: false },
    'ml': { unit_category: 'volume', min_value: 0, decimal_places: 1, allow_negative: false },
    'units': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'vials': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'tubes': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'plates': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'strips': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false },
    'kits': { unit_category: 'count', min_value: 0, decimal_places: 0, allow_negative: false }
};
class UnitValidationService {
    static validateQuantity(unitId, quantity) {
        const rules = exports.UNIT_VALIDATION_RULES[unitId];
        if (!rules) {
            // For custom units, allow any positive number
            return quantity >= 0
                ? { isValid: true }
                : { isValid: false, error: 'Quantity cannot be negative' };
        }
        if (!rules.allow_negative && quantity < 0) {
            return { isValid: false, error: 'Negative quantities not allowed for this unit' };
        }
        if (rules.min_value !== undefined && quantity < rules.min_value) {
            return { isValid: false, error: `Minimum quantity is ${rules.min_value}` };
        }
        if (rules.max_value !== undefined && quantity > rules.max_value) {
            return { isValid: false, error: `Maximum quantity is ${rules.max_value}` };
        }
        if (rules.decimal_places !== undefined) {
            const decimalPlaces = (quantity.toString().split('.')[1] || '').length;
            if (decimalPlaces > rules.decimal_places) {
                return {
                    isValid: false,
                    error: `Maximum ${rules.decimal_places} decimal places allowed`
                };
            }
        }
        return { isValid: true };
    }
    static validateUnitConversion(fromUnit, toUnit, factor) {
        const fromRules = exports.UNIT_VALIDATION_RULES[fromUnit];
        const toRules = exports.UNIT_VALIDATION_RULES[toUnit];
        if (!fromRules || !toRules) {
            return { isValid: true }; // Allow custom unit conversions
        }
        if (fromRules.unit_category !== toRules.unit_category) {
            return {
                isValid: false,
                error: 'Cannot convert between different unit categories'
            };
        }
        if (factor <= 0) {
            return { isValid: false, error: 'Conversion factor must be positive' };
        }
        return { isValid: true };
    }
    static validatePurchaseConsumptionUnits(purchaseUnit, consumptionUnit, unitsPerPurchaseUnit) {
        if (unitsPerPurchaseUnit <= 0) {
            return { isValid: false, error: 'Units per purchase unit must be greater than 0' };
        }
        // For now, allow any combination, but we could add business rules later
        // e.g., weight units should match, count units should match, etc.
        return { isValid: true };
    }
    static validateTransactionUnitConversion(unitType, purchaseUnit, consumptionUnit, unitsPerPurchaseUnit) {
        if (unitType === 'consumption') {
            // No conversion needed for consumption units
            return { isValid: true };
        }
        if (unitType === 'purchase') {
            if (!purchaseUnit) {
                return { isValid: false, error: 'Purchase unit is required when unit_type is purchase' };
            }
            if (!unitsPerPurchaseUnit || unitsPerPurchaseUnit <= 0) {
                return { isValid: false, error: 'Units per purchase unit must be specified and greater than 0' };
            }
            // Could add validation that purchase and consumption units are compatible
            return { isValid: true };
        }
        return { isValid: false, error: 'Invalid unit type' };
    }
}
exports.UnitValidationService = UnitValidationService;

import type { billingsettings } from './Type';

export const DEFAULT_BILLING_SETTINGS: Readonly<billingsettings> = Object.freeze({
     hasNightAdjustment: false,
     nightAdjustmentValue: '0',
     nightAdjustmentMode: 'absolute',
     startTime: '22:00',
     endTime: '06:00',
});

export function parseBillingSettings(value: unknown): billingsettings | null {
     if (value == null || typeof value === 'string' && !value.trim()) return null;
     const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
     if (parsed == null) return null;
     if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Billing settings must be a JSON object');
     }
     if (Object.keys(parsed).length === 0) return null;
     return parsed as billingsettings;
}

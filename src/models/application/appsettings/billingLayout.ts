export const BILLING_LAYOUTS = ['multi-compact', 'multi-primary-two'] as const;
export type BillingLayout = typeof BILLING_LAYOUTS[number];
export const isBillingLayout = (value: unknown): value is BillingLayout => BILLING_LAYOUTS.some(layout => layout === value);

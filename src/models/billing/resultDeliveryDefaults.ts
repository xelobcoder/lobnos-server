export const DEFAULT_RESULT_DELIVERY_MODE = 'hard copy';

export interface ResolvedDeliveryPreference {
     requested_mode: string;
     requested_mode_detail: string | null;
     updated_by_employeeid: number | null;
}

/**
 * Returns the delivery preference submitted for a test, or the facility default
 * (hard copy) when the delivery prompt is disabled or no preference was sent.
 */
export function resolveTestDeliveryPreference(resultDelivery: any, testId: unknown, fallbackEmployeeId?: number | string | null): ResolvedDeliveryPreference {
     const preferences = Array.isArray(resultDelivery?.preferences) ? resultDelivery.preferences : [];
     const match = preferences.find((item: any) => item && item.testid == testId);
     const mode = typeof match?.requested_mode === 'string' && match.requested_mode.trim()
          ? match.requested_mode.trim().toLowerCase()
          : DEFAULT_RESULT_DELIVERY_MODE;
     const employee = match?.employeeid ?? resultDelivery?.employeeid ?? fallbackEmployeeId;
     const employeeId = Number(employee);
     return {
          requested_mode: mode,
          requested_mode_detail: match && mode !== DEFAULT_RESULT_DELIVERY_MODE ? (match.requested_mode_detail ?? null) : null,
          updated_by_employeeid: Number.isFinite(employeeId) && employeeId > 0 ? employeeId : null,
     };
}

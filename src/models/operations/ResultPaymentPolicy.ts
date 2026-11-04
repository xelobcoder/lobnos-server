export type ResultPaymentAction = 'entry' | 'validation' | 'print';

const flags = {
     entry: 'allowResultEnteringUpaid',
     validation: 'allowValidationUpaid',
     print: 'allowPrintingUnpaid',
} as const;

export function allowsUnpaidResultAction(settings: any, action: ResultPaymentAction): boolean {
     return Number(settings?.[flags[action]]) === 1;
}

export function isPaidResultService(status: unknown): boolean {
     return String(status ?? '').trim().toLowerCase() === 'paid';
}

/** Pass the current transaction for writes, so settings and service payment are checked under locks. */
export async function canPerformResultAction(db: any, ascensionid: number, action: ResultPaymentAction, lock = false): Promise<boolean> {
     const settingsQuery = db('applicationsettings');
     if (lock) settingsQuery.forShare();
     const settings = await settingsQuery.first(flags[action]);
     if (allowsUnpaidResultAction(settings, action)) return true;
     const ascension = await db('test_ascension').where({ id: ascensionid }).first('serviceid');
     if (!ascension?.serviceid) return false;
     const serviceQuery = db('dboservices').where({ serviceid: ascension.serviceid });
     if (lock) serviceQuery.forUpdate();
     const service = await serviceQuery.first('paymentstatus');
     return isPaidResultService(service?.paymentstatus);
}

export async function assertResultPaymentPolicy(db: any, ascensionid: number, action: ResultPaymentAction, lock = false): Promise<void> {
     if (await canPerformResultAction(db, ascensionid, action, lock)) return;
     const labels = { entry: 'Result entry', validation: 'Result validation', print: 'Result printing' };
     throw Object.assign(new Error(`${labels[action]} is disabled for unpaid services. Complete payment before continuing.`), {
          statusCode: 403, code: `UNPAID_RESULT_${action.toUpperCase()}_DISABLED`,
     });
}

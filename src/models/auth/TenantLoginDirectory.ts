export type LoginEntityType = 'staff' | 'patient' | 'clinician';

const ENTITY_CODES: Record<LoginEntityType, string> = {
     staff: 'S',
     patient: 'P',
     clinician: 'C',
};

export interface ParsedLoginUsername {
     organizationIdentifier: string;
     entityType: LoginEntityType;
     entityId: number;
     loginUsername: string;
}

/** Produces a public organization identifier + account type + local ID, not an internal tenant ID. */
export function formatLoginUsername(organizationIdentifier: string, entityType: LoginEntityType, entityId: number): string {
     const prefix = String(organizationIdentifier || '').trim().toUpperCase();
     if (!/^[A-Z][A-Z0-9]{2,31}$/.test(prefix)) {
          throw new RangeError('Organization identifier must contain 3-32 letters/digits and start with a letter');
     }
     if (!Number.isSafeInteger(entityId) || entityId <= 0 || entityId > 999999999) {
          throw new RangeError('Account ID must be between 1 and 999999999');
     }
     return `${prefix}${ENTITY_CODES[entityType]}${String(entityId).padStart(3, '0')}`;
}

/** Parses e.g. PLS20154S004; the last S/C/P before the numeric account ID is the type. */
export function parseLoginUsername(value: string): ParsedLoginUsername | null {
     const compact = String(value || '').trim().toUpperCase();
     const match = compact.match(/^([A-Z][A-Z0-9]{2,31})([SPC])(\d{1,9})$/);
     if (!match) return null;

     const entityId = Number(match[3]);
     if (!Number.isSafeInteger(entityId) || entityId <= 0) return null;

     const entityType = (Object.keys(ENTITY_CODES) as LoginEntityType[])
          .find((type) => ENTITY_CODES[type] === match[2]);
     if (!entityType) return null;
     return {
          organizationIdentifier: match[1],
          entityType,
          entityId,
          loginUsername: formatLoginUsername(match[1], entityType, entityId),
     };
}

export type QuickReferralEntityKind = 'organization' | 'clinician';

export interface QuickReferralEntityInput {
     name: string;
     phone: string | null;
     email: string | null;
     /** Clinicians only: organization the clinician is referring from, linked on creation. */
     organizationId?: number | null;
}

const LIMITS: Record<QuickReferralEntityKind, { name: number; email: number }> = {
     organization: { name: 255, email: 255 },
     clinician: { name: 255, email: 100 },
};

const optionalText = (value: unknown): string | null => {
     if (value === undefined || value === null) return null;
     const text = String(value).trim();
     return text ? text : null;
};

/** Validates quick-add input: only the name is required; phone and email are optional contact details. */
export function normalizeQuickReferralEntity(kind: QuickReferralEntityKind, body: any):
     { value: QuickReferralEntityInput | null; error: string | null } {
     const fail = (error: string) => ({ value: null, error });
     const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim();
     if (!name) return fail(`Enter the ${kind} name`);
     if (name.length > LIMITS[kind].name) return fail(`The ${kind} name is too long`);

     const phone = optionalText(body?.phone ?? body?.mobile)?.replace(/[\s-]/g, '') ?? null;
     if (phone && !/^0\d{9}$/.test(phone)) return fail('Enter a valid 10-digit phone number starting with 0, or leave it blank');

     const email = optionalText(body?.email)?.toLowerCase() ?? null;
     if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > LIMITS[kind].email)) {
          return fail('Enter a valid email address, or leave it blank');
     }
     if (kind === 'clinician' && body?.organizationId !== undefined && body?.organizationId !== null && body?.organizationId !== '') {
          const organizationId = Number(body.organizationId);
          if (!Number.isSafeInteger(organizationId) || organizationId <= 0) return fail('Select a valid organization, or leave it blank');
          return { value: { name, phone, email, organizationId }, error: null };
     }
     return { value: { name, phone, email }, error: null };
}

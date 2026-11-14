import { describe, expect, it, vi } from 'vitest';
import type { Knex } from 'knex';
import { findPatientDuplicates } from './PatientDuplicateService';

function database(candidates: object[]) {
     const insert = vi.fn();
     const table = { whereNot: vi.fn().mockReturnThis(), whereRaw: vi.fn().mockReturnThis(), select: vi.fn().mockResolvedValue(candidates) };
     const db = Object.assign(vi.fn((name: string) => name === 'new_patients' ? table : { insert }), { raw: vi.fn() });
     return { db: db as unknown as Knex, insert, table };
}

describe('registration duplicate review', () => {
     const identity = {
          firstname: ' Ada ', lastname: 'DOE', dob: '1990-05-01',
          email: 'a@example.com', mobile_number: '0240000000', contact_pointer: 'self',
     } as Parameters<typeof findPatientDuplicates>[1];

     it('returns corroborating evidence and rejects contradictory birth dates', async () => {
          const { db, insert, table } = database([
               { patientid: 10, dob: '1990-05-01' },
               { patientid: 11, dob: '1991-06-01', email: 'a@example.com' },
          ]);
          expect(await findPatientDuplicates(db, identity, 42)).toMatchObject([
               { patientid: 10, evidence: 'First and last name, Date of birth' },
          ]);
          expect(table.whereNot).toHaveBeenCalledWith('patientid', 42);
          expect(table.whereRaw).toHaveBeenCalledWith(expect.stringContaining('firstname'), ['ada']);
          expect(insert).not.toHaveBeenCalled();
     });

     it('does not treat a relative phone, or names alone, as corroboration', async () => {
          const { db, insert } = database([{ patientid: 10, contactpointer: 'relative', mobile_number: '0240000000' }]);
          expect(await findPatientDuplicates(db, identity, 42)).toEqual([]);
          expect(insert).not.toHaveBeenCalled();
     });
});

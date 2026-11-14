import type { Knex } from 'knex';
import type { ICreateNewPatient } from '../patients/interfaces';

type Identity = Pick<ICreateNewPatient, 'firstname' | 'lastname' | 'dob' | 'email' | 'mobile_number' | 'contact_pointer'>;
const name = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const email = (value: unknown) => String(value ?? '').trim().toLowerCase();
const phone = (value: unknown) => String(value ?? '').replace(/[^0-9]/g, '');
function birthday(value: unknown) {
     const day = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);
     return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(day) ? day : '';
}

export async function flagPatientDuplicates(db: Knex, patientId: number, identity: Identity) {
     const first = name(identity.firstname);
     const last = name(identity.lastname);
     const dob = birthday(identity.dob);
     const address = email(identity.email);
     const mobile = identity.contact_pointer === 'self' ? phone(identity.mobile_number) : '';
     if (!first || !last || (!dob && !address && !mobile)) return 0;

     const candidates = await db('new_patients').whereNot('patientid', patientId)
          .whereRaw("LOWER(REGEXP_REPLACE(TRIM(firstname), '[[:space:]]+', ' ')) = ?", [first])
          .whereRaw("LOWER(REGEXP_REPLACE(TRIM(lastname), '[[:space:]]+', ' ')) = ?", [last])
          .select('patientid', 'email', 'mobile_number', 'contactpointer', db.raw("DATE_FORMAT(dob, '%Y-%m-%d') as dob"));
     const flags = candidates.flatMap(candidate => {
          const candidateDob = birthday(candidate.dob);
          if (dob && candidateDob && dob !== candidateDob) return [];
          const evidence = [
               dob && dob === candidateDob && 'Date of birth',
               address && address === email(candidate.email) && 'Email',
               mobile && candidate.contactpointer === 'self' && mobile === phone(candidate.mobile_number) && 'Self mobile number',
          ].filter(Boolean);
          return evidence.length ? [{
               registered_patient_id: patientId, candidate_patient_id: candidate.patientid,
               evidence: ['First and last name', ...evidence].join(', '),
          }] : [];
     });

     if (flags.length) await db('patient_duplicate_candidates').insert(flags);
     return flags.length;
}

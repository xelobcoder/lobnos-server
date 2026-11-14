import knex from 'knex';
import { expect, it, vi } from 'vitest';
import KnexConnection from '../../database/KnexConnections';
import Registration from './registration';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../database/appLevelTriggers', () => ({ applyNewPatientAfterInsert: vi.fn() }));
vi.mock('../application/in-app-notifications/InAppNotificationService', () => ({ InAppNotificationService: {} }));
vi.mock('../application/notifications/services/NotificationDispatcher', () => ({ NotificationDispatcher: {} }));

it('saves an existing patient without optional fields and preserves omitted data', async () => {
     const db = knex({ client: 'mysql2' });
     const statements: { sql: string; bindings: readonly unknown[] }[] = [];
     try {
          vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => callback(db) as any);
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({
               run: async () => {
                    const compiled = builder.toSQL();
                    statements.push(compiled);
                    return compiled.method === 'raw' ? [{ affectedRows: 1 }] : 1;
               },
          }) as any);
          vi.mocked(KnexConnection).mockResolvedValue(db);
          vi.spyOn(Registration, 'checkPatientIdExist').mockResolvedValue(true);
          vi.spyOn(Registration, 'getPatientDataUsingPatientId').mockResolvedValue(null);
          vi.spyOn(Registration as any, 'createPatientAuditLog').mockResolvedValue(undefined);

          await expect(Registration.UpdatePersonalInformation(1, {
               firstname: 'Synthetic', age: 65, contact_pointer: 'relative' as any,
               contact_relationship: 'mother', relativecontactname: 'Synthetic Guardian',
               relativecontactnumber: '0000009711', backup_phone: '',
          }, 7)).resolves.toBe(true);
          const update = statements.find(statement => /update.*new_patients/i.test(statement.sql));
          expect(update?.sql).not.toMatch(/email|dob|organization|occupation|marital_status|whatAppcontact/i);
          expect(update?.sql).toContain('`mobile_number`');
          expect(update?.bindings).toContain(null);
          expect(update?.bindings).toContain('0000009711');
     } finally {
          vi.restoreAllMocks();
          await db.destroy();
     }
});

it('rejects taking another patient’s primary number on an edit', async () => {
     const db = knex({ client: 'mysql2' });
     const updates = vi.fn();
     try {
          vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => callback(db) as any);
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({
               run: async () => {
                    const query = builder.toSQL();
                    if (query.method === 'update') { updates(); return 1; }
                    if (query.sql.includes('applicationsettings')) return { keyid: 1 };
                    return query.bindings.includes('0000009711') ? { patientid: 9 } : { patientid: 7, mobile_number: '0000009712', contactpointer: 'self' };
               },
          }) as any);
          vi.mocked(KnexConnection).mockResolvedValue(db);
          vi.spyOn(Registration, 'checkPatientIdExist').mockResolvedValue(true);
          vi.spyOn(Registration, 'getPatientDataUsingPatientId').mockResolvedValue(null);
          vi.spyOn(Registration as any, 'createPatientAuditLog').mockResolvedValue(undefined);
          await expect(Registration.UpdatePersonalInformation(1, {
               firstname: 'Different Name', mobile_number: '0000009711', contact_relationship: 'self',
          }, 7)).rejects.toMatchObject({ code: 'PATIENT_PRIMARY_CONTACT_IN_USE' });
          expect(updates).not.toHaveBeenCalled();
     } finally {
          vi.restoreAllMocks();
          await db.destroy();
     }
});

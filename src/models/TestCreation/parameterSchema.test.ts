import { afterEach, expect, it } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { ensureParameterDefinitionSchema } from './parameterSchema';

it('upgrades an existing tenant parameter catalog additively and defaults reruns off', async () => {
     const fixture = accountingSqlDatabase();
     try {
          await fixture.db.schema.createTable('testcreationrules', table => {
               table.increments('id'); table.integer('testid'); table.string('name'); table.string('plan');
          });
          await fixture.db('testcreationrules').insert({ id: 8, testid: 4, name: 'Existing result parameter', plan: 'input' });
          await ensureParameterDefinitionSchema(fixture.db as any);
          await ensureParameterDefinitionSchema(fixture.db as any);
          const row = await fixture.db('testcreationrules').where({ id: 8 }).first();
          expect(Number(row.manual_rerun_enabled)).toBe(0);
          expect(Number(row.isRequired)).toBe(0);
     } finally {
          await fixture.db.destroy();
     }
});

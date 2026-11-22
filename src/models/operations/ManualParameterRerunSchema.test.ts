import { afterEach, expect, it } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { ensureManualParameterRerunSchema } from './ManualParameterRerunSchema';

it('bootstraps rerun staging and immutable audit tables idempotently for an existing tenant', async () => {
     const fixture = accountingSqlDatabase();
     try {
          await ensureManualParameterRerunSchema(fixture.db as any);
          await ensureManualParameterRerunSchema(fixture.db as any);
          expect(await fixture.db.schema.hasTable('lab_manual_parameter_reruns')).toBe(true);
          expect(await fixture.db.schema.hasTable('lab_manual_parameter_rerun_values')).toBe(true);
          expect(await fixture.db.schema.hasTable('lab_manual_parameter_rerun_events')).toBe(true);
     } finally {
          await fixture.db.destroy();
     }
});

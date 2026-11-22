import { describe, expect, it, vi } from 'vitest';
import { assertCollectionConsent, getCollectionConsentMode } from './CollectionConsentPolicy';

function databaseWithSettings(settings?: unknown, hasTable = true) {
     const query = {
          where: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(settings === undefined ? undefined : { resultsEntrySettings: settings }),
     };
     const db = vi.fn(() => query) as any;
     db.schema = { hasTable: vi.fn().mockResolvedValue(hasTable) };
     return db;
}

describe('collection consent policy', () => {
     it('defaults to off when result settings are not provisioned', async () => {
          expect(await getCollectionConsentMode(databaseWithSettings(undefined, false))).toBe('off');
          expect(await getCollectionConsentMode(databaseWithSettings())).toBe('off');
     });

     it('uses the configured collection mode', async () => {
          const db = databaseWithSettings(JSON.stringify({ electronicConsentMode: 'optional' }));
          expect(await getCollectionConsentMode(db)).toBe('optional');
     });

     it('requires a confirmation only in required mode', async () => {
          const db = databaseWithSettings({ electronicConsentMode: 'required' });
          await expect(assertCollectionConsent(db, undefined)).rejects.toMatchObject({
               statusCode: 409,
               code: 'CONSENT_REQUIRED',
          });
          await expect(assertCollectionConsent(db, { confirmed: true })).resolves.toEqual({
               mode: 'required',
               confirmed: true,
          });
     });

     it('does not record confirmation when collection consent is off', async () => {
          await expect(assertCollectionConsent(databaseWithSettings({ electronicConsentMode: 'off' }), {
               confirmed: true,
          })).resolves.toEqual({ mode: 'off', confirmed: false });
     });

     it('reports malformed facility settings instead of silently disabling consent', async () => {
          await expect(getCollectionConsentMode(databaseWithSettings('{'))).rejects.toMatchObject({
               statusCode: 503,
          });
     });
});

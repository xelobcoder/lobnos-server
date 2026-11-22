export type CollectionConsentMode = 'off' | 'optional' | 'required';

export async function getCollectionConsentMode(db: any): Promise<CollectionConsentMode> {
     if (!db.schema?.hasTable || !await db.schema.hasTable('resultsettings')) return 'off';
     const row = await db('resultsettings').where({ id: 1 }).first();
     if (!row?.resultsEntrySettings) return 'off';

     let settings: any;
     try {
          settings = typeof row.resultsEntrySettings === 'string'
               ? JSON.parse(row.resultsEntrySettings)
               : row.resultsEntrySettings;
     } catch {
          throw Object.assign(new Error('Facility workflow settings are invalid'), { statusCode: 503 });
     }

     const mode = settings?.electronicConsentMode;
     return mode === 'optional' || mode === 'required' || mode === 'off' ? mode : 'off';
}

export async function assertCollectionConsent(db: any, consent: { confirmed?: boolean } | null | undefined) {
     const mode = await getCollectionConsentMode(db);
     if (mode === 'required' && consent?.confirmed !== true) {
          throw Object.assign(new Error('Collection consent is required before collection can proceed.'), {
               statusCode: 409,
               code: 'CONSENT_REQUIRED',
          });
     }
     return { mode, confirmed: mode !== 'off' && consent?.confirmed === true };
}

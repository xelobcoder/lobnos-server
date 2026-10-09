import KnexConnection from '../../../../database/KnexConnections';

// Reference configuration from primelabtestmig, without its staff IDs or contact number.
const disclaimer = 'A definitive clinical diagnosis requires careful consideration of all relevant clinical and diagnostic data.';
export const DEFAULT_RESULT_SETTINGS = {
     fontfamily: 'Lexend Deca, Helvetica, Arial, sans-serif',
     testnameColor: '#4169e1', testnameBackgroundColor: '#ffffff', testnameFontSize: 14,
     mainReportHeaderBgColor: '#4169e1', testTableHeaderBackgroundColor: '#4169e1',
     testTableHeaderTextColor: '#0d0c0c', mainReportHeaderColor: '#000000', testTableHeaderFontSize: 13,
     companyInfo: { namefontsize: 27, color: '#4169e1', breakname: false, subnameFontSize: 12,
          subnameColor: '#000000', fontFamily: 'Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif', headerType: 'default' },
     patientInfo: { fontFamily: 'Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif' },
     testBody: { trFirstColumnName: 'Parameter', trSecondColumnName: 'Results', trThirdColumnName: 'Units',
          trFourthColumnName: 'Range', trFifthColumnName: 'Flag', fontSize: 15,
          fontFamily: 'Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif', color: 'black',
          highlightFlags: true, hightFlagColor: '#b04545', hasColorsForFlags: false, lowFlagColor: '#1eb870',
          boldenParameter: true, boldenValue: true, boldenUnits: true },
     includeSignature: false, includeLimitations: true, limitations: disclaimer,
     useGeneraralValidation: false, useIndividualValidations: true, includeBarcode: false, showEndOfResult: false,
     comments: { fontFamily: 'Times New Roman, Times, serif', fontSize: 13, color: 'black', backgroundColor: 'transparent',
          fontStyle: 'normal', fontWeight: 'normal', textAlign: 'left', showHeading: true, headingColor: 'black' },
     template: '2', includeWatermark: true, showMethod: false, useReportTitle: true,
     ultrasoundSettings: { showTechnique: false, showFindings: true, showImpression: true, showSonographer: true,
          showDisclaimer: true, disclaimerText: disclaimer, contentFontSize: 16, contentColor: '#496f97',
          headerFontSize: 25, contentFontFamily: 'Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif',
          headerBackgroundColor: '#4169e1', fontSize: 20, headerTextColor: '#1d1b1b', sectionTitleFontSize: 14,
          lineHeight: '1.5', sectionTitleColor: '#ffffff', fontFamily: 'Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif',
          allowUltrasoundImages: true },
     useInstrumentation: false,
};

export const DEFAULT_RESULT_ENTRY_SETTINGS = {
     resultLockAfter24Hours: 1, isPinOnResultEntry: 1, isPinOnResultViewAfter24Hours: 1,
     maximumResultValidation: 10, minimumResultValidation: 1, showPastTestResult: 1,
     allowScientistViewAudit: 1, showTaTAnalysis: 1, encryptResultAfter24Hours: 0,
     sendLoginEmailNotificationAfterResultEdit: 0, monitorForCriticalValues: 1,
     notifyClientOnResultReady: 0, notificationType: 'Email', staffQualifiedToValidationResult: [],
};

export async function bootstrapResultSettings(tenantId: number): Promise<void> {
     const db = await KnexConnection(tenantId);
     if (!(await db.schema.hasTable('resultsettings'))) {
          await db.schema.createTable('resultsettings', table => {
               table.increments('id').unsigned().primary();
               table.text('resultsettings', 'longtext').notNullable();
               table.text('resultsEntrySettings', 'longtext').nullable();
          });
     } else {
          for (const column of ['resultsettings', 'resultsEntrySettings']) {
               if (!(await db.schema.hasColumn('resultsettings', column))) {
                    await db.schema.alterTable('resultsettings', table => table.text(column, 'longtext').nullable());
               }
          }
     }
     const defaults = {
          resultsettings: JSON.stringify(DEFAULT_RESULT_SETTINGS),
          resultsEntrySettings: JSON.stringify(DEFAULT_RESULT_ENTRY_SETTINGS),
     };
     await db.transaction(async trx => {
          await trx('resultsettings').insert({ id: 1, ...defaults }).onConflict('id').merge(['id']);
          const row = await trx('resultsettings').where({ id: 1 }).forUpdate().first();
          const missing: Record<string, string> = {};
          for (const column of ['resultsettings', 'resultsEntrySettings'] as const) {
               if (row[column] === null || row[column] === undefined || row[column] === '') missing[column] = defaults[column];
          }
          if (Object.keys(missing).length) await trx('resultsettings').where({ id: 1 }).update(missing);
     });
}

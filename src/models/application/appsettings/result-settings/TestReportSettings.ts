import KnexConnection from '../../../../database/KnexConnections';
import ResultSettings from './resultSettings';
import { ApplicationResultSettings } from '../interfaces/results-settings.interface';

// Per-test report layout override. Falls back to the tenant-wide `resultsettings` (general report settings) when no row exists for a test.
class TestReportSettings {

     static async getForTest(tenantId: number, testid: number): Promise<ApplicationResultSettings | null> {
          const connection = await KnexConnection(tenantId);
          const row = await connection('test_report_settings').where({ testid }).first();
          if (!row || !row.resultsettings) return null;
          try {
               return JSON.parse(row.resultsettings);
          } catch (err) {
               return null;
          }
     }

     static async hasCustomSettings(tenantId: number, testid: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const row = await connection('test_report_settings').where({ testid }).first();
          return !!row;
     }

     static async upsert(tenantId: number, testid: number, data: ApplicationResultSettings): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const jsonify = JSON.stringify(data);
          const existing = await connection('test_report_settings').where({ testid }).first();

          if (existing) {
               const affected = await connection('test_report_settings')
                    .where({ testid })
                    .update({ resultsettings: jsonify, updated_at: connection.fn.now() });
               return affected > 0;
          }

          const inserted = await connection('test_report_settings').insert({ testid, resultsettings: jsonify });
          return Array.isArray(inserted) ? inserted.length > 0 : !!inserted;
     }

     static async remove(tenantId: number, testid: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const affected = await connection('test_report_settings').where({ testid }).delete();
          return affected > 0;
     }

     // Resolves the settings that should be used for printing a given test's report.
     static async resolve(tenantId: number, testid: number): Promise<ApplicationResultSettings | boolean> {
          const testSettings = await TestReportSettings.getForTest(tenantId, testid);
          if (testSettings) return testSettings;
          return new ResultSettings(0).getResultSettings(tenantId);
     }
}

export default TestReportSettings;

import { Knex } from 'knex';
import { FacilityError } from './FacilityInput';
import { formatCents } from './FacilityManagementInput';

export const FACILITY_MODULES = ['pharmacy', 'email', 'sms', 'inventory', 'deviceInterfacing'] as const;
export type FacilityModule = typeof FACILITY_MODULES[number];
export interface FacilityModuleConfiguration {
     branchMode: 'single' | 'multiple';
     currency: string;
     modules: Record<FacilityModule, { enabled: boolean; monthlyPrice: string }>;
     monthlyTotal: string;
}
export const MODULE_CONFIG_TABLE = 'facility_module_configuration';

export function validateModuleConfiguration(value: unknown): FacilityModuleConfiguration | null {
     if (value === undefined) return null; // Existing API clients retain their legacy setup.
     if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FacilityError('moduleConfiguration must be an object');
     const input = value as Record<string, unknown>;
     if (input.branchMode !== 'single' && input.branchMode !== 'multiple') throw new FacilityError('branchMode must be single or multiple');
     if (typeof input.currency !== 'string' || !/^[A-Z]{3}$/.test(input.currency)) throw new FacilityError('Module currency must be three uppercase letters');
     if (!input.modules || typeof input.modules !== 'object' || Array.isArray(input.modules)) throw new FacilityError('Module selections are required');
     const entries = input.modules as Record<string, unknown>;
     if (Object.keys(entries).some(key => !(FACILITY_MODULES as readonly string[]).includes(key))) throw new FacilityError('Unknown facility module');
     const modules = {} as FacilityModuleConfiguration['modules'];
     let total = 0;
     for (const module of FACILITY_MODULES) {
          const raw = entries[module];
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new FacilityError(`${module} configuration is required`);
          const item = raw as Record<string, unknown>;
          if (typeof item.enabled !== 'boolean') throw new FacilityError(`${module}.enabled must be a boolean`);
          if (typeof item.monthlyPrice !== 'string' || !/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(item.monthlyPrice)) {
               throw new FacilityError(`${module}.monthlyPrice must be a nonnegative decimal string with at most two decimal places`);
          }
          const [whole, fraction = ''] = item.monthlyPrice.split('.');
          const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
          modules[module] = { enabled: item.enabled, monthlyPrice: formatCents(cents) };
          if (item.enabled) total += cents;
     }
     if (total > 999_999_999_999) throw new FacilityError('Total module price exceeds the supported monthly amount');
     return { branchMode: input.branchMode, currency: input.currency, modules, monthlyTotal: formatCents(total) };
}

export async function ensureFacilityModuleTable(db: Knex): Promise<void> {
     if (await db.schema.hasTable(MODULE_CONFIG_TABLE)) return;
     try {
          await db.schema.createTable(MODULE_CONFIG_TABLE, table => {
               table.integer('tenant_id').unsigned().primary();
               table.text('configuration', 'longtext').notNullable();
          });
     } catch (error) {
          if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
     }
}

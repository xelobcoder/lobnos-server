import { Knex } from 'knex';
import { systemConfigConnection } from '../../database/connection';
import { FacilityError } from './FacilityInput';
import { formatCents } from './FacilityManagementInput';
import { FACILITY_MODULES, FacilityModule, FacilityModuleConfiguration } from './FacilityModules';

export const MODULE_PRICING_CATALOG_TABLE = 'facility_module_pricing_catalog';
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MAX_PRICE_CENTS = 999_999_999_999;

export interface FacilityModulePricingInput {
     currency: string;
     modules: Record<FacilityModule, string>;
}

export interface FacilityModulePricingView extends FacilityModulePricingInput { }

function validateCurrency(value: unknown): string {
     if (typeof value !== 'string' || !CURRENCY_PATTERN.test(value)) {
          throw new FacilityError('Currency must be three uppercase letters');
     }
     return value;
}

function priceToCents(value: unknown, field: string): number {
     if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) {
          throw new FacilityError(`${field} must be a nonnegative decimal string with at most two decimal places`);
     }
     const [whole, fraction = ''] = value.split('.');
     const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
     if (!Number.isSafeInteger(cents) || cents > MAX_PRICE_CENTS) {
          throw new FacilityError(`${field} exceeds the supported monthly amount`);
     }
     return cents;
}

/** Validate a complete catalog entry; request keys never become table or column identifiers. */
export function validateFacilityModulePricing(value: unknown): FacilityModulePricingView {
     if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new FacilityError('Module pricing must be an object');
     }
     const input = value as Record<string, unknown>;
     const currency = validateCurrency(input.currency);
     if (!input.modules || typeof input.modules !== 'object' || Array.isArray(input.modules)) {
          throw new FacilityError('Module prices are required');
     }
     const rawModules = input.modules as Record<string, unknown>;
     const expected = new Set<string>(FACILITY_MODULES);
     if (Object.keys(rawModules).some(module => !expected.has(module))) {
          throw new FacilityError('Unknown facility module');
     }
     const modules = {} as Record<FacilityModule, string>;
     for (const module of FACILITY_MODULES) {
          if (!Object.prototype.hasOwnProperty.call(rawModules, module)) {
               throw new FacilityError(`${module} price is required`);
          }
          modules[module] = formatCents(priceToCents(rawModules[module], `${module} price`));
     }
     return { currency, modules };
}

/**
 * Store the catalog in the system/master database. This is deliberately runtime-initialized:
 * no tenant schema migration is needed, and every newly initialized catalog has a safe GHS baseline.
 */
export async function ensureFacilityModulePricingCatalog(db: Knex): Promise<void> {
     if (!(await db.schema.hasTable(MODULE_PRICING_CATALOG_TABLE))) {
          try {
               await db.schema.createTable(MODULE_PRICING_CATALOG_TABLE, table => {
                    table.string('currency', 3).notNullable();
                    table.string('module', 32).notNullable();
                    table.decimal('monthly_price', 12, 2).notNullable();
                    table.primary(['currency', 'module']);
               });
          } catch (error: any) {
               // Concurrent first access may create the table between hasTable and createTable.
               if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
          }
     }
     await db(MODULE_PRICING_CATALOG_TABLE).insert(FACILITY_MODULES.map(module => ({
          currency: 'GHS', module, monthly_price: '0.00',
     }))).onConflict(['currency', 'module']).ignore();
}

export async function readFacilityModulePricing(
     db: Knex, currencyValue: unknown = 'GHS',
): Promise<FacilityModulePricingView> {
     const currency = validateCurrency(currencyValue);
     await ensureFacilityModulePricingCatalog(db);
     const rows = await db(MODULE_PRICING_CATALOG_TABLE).where({ currency }).select('module', 'monthly_price');
     return formatFacilityModulePricingRows(currency, rows);
}

function formatFacilityModulePricingRows(currency: string, rows: any[]): FacilityModulePricingView {
     const byModule = new Map<string, unknown>(rows.map((row: any) => [row.module, row.monthly_price]));
     const modules = {} as Record<FacilityModule, string>;
     for (const module of FACILITY_MODULES) {
          if (!byModule.has(module)) {
               throw new FacilityError(`No complete module pricing catalog exists for ${currency}`, 404);
          }
          modules[module] = formatCents(priceToCents(String(byModule.get(module)), `${module} catalog price`));
     }
     return { currency, modules };
}

export class FacilityModulePricingCatalog {
     constructor(private master: Knex = systemConfigConnection) { }

     async get(currency: unknown = 'GHS'): Promise<FacilityModulePricingView> {
          return readFacilityModulePricing(this.master, currency);
     }

     async getAll(): Promise<FacilityModulePricingView[]> {
          await ensureFacilityModulePricingCatalog(this.master);
          const rows = await this.master(MODULE_PRICING_CATALOG_TABLE)
               .select('currency', 'module', 'monthly_price');
          const grouped = new Map<string, any[]>();
          for (const row of rows) {
               const currency = validateCurrency(row.currency);
               const currencyRows = grouped.get(currency) || [];
               currencyRows.push(row);
               grouped.set(currency, currencyRows);
          }
          return [...grouped.keys()].sort().map(currency =>
               formatFacilityModulePricingRows(currency, grouped.get(currency)!));
     }

     async put(value: unknown): Promise<FacilityModulePricingView> {
          const validated = validateFacilityModulePricing(value);
          await ensureFacilityModulePricingCatalog(this.master);
          await this.master.transaction(async trx => {
               await trx(MODULE_PRICING_CATALOG_TABLE).insert(FACILITY_MODULES.map(module => ({
                    currency: validated.currency, module, monthly_price: validated.modules[module],
               }))).onConflict(['currency', 'module']).merge(['monthly_price']);
          });
          return validated;
     }
}

/** Preserve entitlements/branch mode, but take every saved price from the authoritative catalog. */
export function applyFacilityModulePricing(
     configuration: FacilityModuleConfiguration, catalog: FacilityModulePricingView,
): FacilityModuleConfiguration {
     if (configuration.currency !== catalog.currency) {
          throw new FacilityError('Module configuration currency does not match the pricing catalog currency');
     }
     const modules = {} as FacilityModuleConfiguration['modules'];
     for (const module of FACILITY_MODULES) {
          modules[module] = {
               enabled: configuration.modules[module].enabled,
               monthlyPrice: catalog.modules[module],
          };
     }
     const totalCents = FACILITY_MODULES.reduce((total, module) => {
          if (!modules[module].enabled) return total;
          const [whole, fraction] = modules[module].monthlyPrice.split('.');
          return total + Number(whole) * 100 + Number(fraction);
     }, 0);
     if (!Number.isSafeInteger(totalCents) || totalCents > MAX_PRICE_CENTS) {
          throw new FacilityError('Total module price exceeds the supported monthly amount');
     }
     return {
          ...configuration,
          modules,
          monthlyTotal: formatCents(totalCents),
     };
}

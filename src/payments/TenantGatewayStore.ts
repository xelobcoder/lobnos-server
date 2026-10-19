import { Knex } from 'knex';
import KnexConnection from '../database/KnexConnections';
import { CredentialCipher } from './CredentialCipher';
import { GATEWAY_PROVIDERS, GatewayError, GatewayProvider } from './types';

export const TENANT_GATEWAY_TABLE = 'tenant_payment_gateways';
export const GATEWAY_APPLICATIONS_TABLE = 'gateway_payment_applications';

/** The secrets and identifiers each provider needs. Base URLs are deliberately not tenant-supplied (SSRF). */
export const PROVIDER_FIELDS: Record<GatewayProvider, readonly string[]> = {
     paystack: ['secretKey'],
     hubtel: ['clientId', 'clientSecret', 'merchantAccount'],
     payswitch: ['apiUser', 'apiKey', 'merchantId'],
};

export interface TenantGatewaySettings {
     provider: GatewayProvider;
     enabled: boolean;
     currency: string;
     credentials: Record<string, string>;
}

export interface TenantGatewayView {
     provider: GatewayProvider;
     configured: boolean;
     enabled: boolean;
     currency: string;
     /** Which fields are stored. Values are never returned. */
     fields: Record<string, boolean>;
     updatedAt: Date | string | null;
}

export interface SaveGatewayInput { enabled?: unknown; currency?: unknown; credentials?: unknown; }

const CURRENCY = /^[A-Z]{3}$/;
const VALUE = /^[^\u0000-\u001f\u007f]{1,200}$/;
const aad = (tenantId: number, provider: string) => `tenant:${tenantId}:${provider}`;

export const isProvider = (value: unknown): value is GatewayProvider => GATEWAY_PROVIDERS.includes(value as GatewayProvider);

/** Tenant-owned merchant credentials, encrypted at rest inside the tenant's own database. */
export class TenantGatewayStore {
     private ready = new Set<number>();

     constructor(
          private cipher: CredentialCipher = CredentialCipher.fromEnv(),
          private getDb: (tenantId: number) => Promise<Knex> = tenantId => KnexConnection(tenantId) as Promise<Knex>,
          private defaultCurrency = (process.env.PAYMENT_DEFAULT_CURRENCY || 'GHS').toUpperCase(),
     ) { }

     get encryptionAvailable() { return this.cipher.available; }

     async ensureSchema(tenantId: number): Promise<Knex> {
          const db = await this.getDb(tenantId);
          if (this.ready.has(tenantId)) return db;
          try {
               if (!(await db.schema.hasTable(TENANT_GATEWAY_TABLE))) {
                    await db.schema.createTable(TENANT_GATEWAY_TABLE, table => {
                         table.string('provider', 20).primary();
                         table.boolean('enabled').notNullable().defaultTo(false);
                         table.string('currency', 3).notNullable();
                         table.text('credentials_enc').notNullable();
                         table.bigInteger('updated_by').notNullable();
                         table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
                         table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
                    });
               }
               if (!(await db.schema.hasTable(GATEWAY_APPLICATIONS_TABLE))) {
                    // One row per gateway reference, written in the same transaction as the bill payment, so a
                    // payment can be applied to the ledger at most once no matter how many times it is retried.
                    await db.schema.createTable(GATEWAY_APPLICATIONS_TABLE, table => {
                         table.string('reference', 64).primary();
                         table.bigInteger('billing_id').notNullable();
                         table.bigInteger('amount_minor').notNullable();
                         table.timestamp('applied_at').notNullable().defaultTo(db.fn.now());
                         table.index(['billing_id'], 'ix_gpa_billing');
                    });
               }
          } catch (error: any) {
               if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
          }
          this.ready.add(tenantId);
          return db;
     }

     /** Decrypted settings for the server's own use (adapters). Never expose the result to a client. */
     async load(tenantId: number, provider: GatewayProvider): Promise<TenantGatewaySettings | null> {
          const db = await this.ensureSchema(tenantId);
          const row = await db(TENANT_GATEWAY_TABLE).where({ provider }).first();
          if (!row) return null;
          return {
               provider, enabled: !!row.enabled, currency: String(row.currency),
               credentials: this.cipher.decrypt(row.credentials_enc, aad(tenantId, provider)),
          };
     }

     private view(provider: GatewayProvider, row: any, credentials: Record<string, string> | null): TenantGatewayView {
          const fields: Record<string, boolean> = {};
          for (const name of PROVIDER_FIELDS[provider]) fields[name] = !!credentials?.[name];
          return {
               provider, configured: Object.values(fields).every(Boolean) && !!row, enabled: !!row?.enabled,
               currency: row?.currency ?? this.defaultCurrency, fields, updatedAt: row?.updated_at ?? null,
          };
     }

     async list(tenantId: number): Promise<TenantGatewayView[]> {
          const db = await this.ensureSchema(tenantId);
          const rows = await db(TENANT_GATEWAY_TABLE).select();
          return GATEWAY_PROVIDERS.map(provider => {
               const row = rows.find((item: any) => item.provider === provider);
               let credentials: Record<string, string> | null = null;
               if (row && this.cipher.available) {
                    try { credentials = this.cipher.decrypt(row.credentials_enc, aad(tenantId, provider)); } catch { credentials = null; }
               }
               return this.view(provider, row, credentials);
          });
     }

     async save(tenantId: number, provider: GatewayProvider, input: SaveGatewayInput, employeeId: number): Promise<TenantGatewayView> {
          if (!this.cipher.available) throw new GatewayError('Payment credential encryption is not configured on the server (PAYMENT_CREDENTIAL_KEY)', 503);
          const allowed = PROVIDER_FIELDS[provider];
          const supplied = input.credentials === undefined ? {} : input.credentials;
          if (typeof supplied !== 'object' || supplied === null || Array.isArray(supplied)) throw new GatewayError('credentials must be an object');
          for (const name of Object.keys(supplied)) {
               if (!allowed.includes(name)) throw new GatewayError(`Unknown credential field: ${name}`);
          }
          const db = await this.ensureSchema(tenantId);
          const existingRow = await db(TENANT_GATEWAY_TABLE).where({ provider }).first();
          const merged: Record<string, string> = existingRow ? this.cipher.decrypt(existingRow.credentials_enc, aad(tenantId, provider)) : {};
          for (const name of allowed) {
               const value = (supplied as Record<string, unknown>)[name];
               if (value === undefined || value === null || value === '') continue;
               if (typeof value !== 'string' || !VALUE.test(value.trim())) throw new GatewayError(`${name} is invalid`);
               merged[name] = value.trim();
          }
          const currency = input.currency === undefined ? (existingRow?.currency ?? this.defaultCurrency) : String(input.currency).toUpperCase();
          if (!CURRENCY.test(currency)) throw new GatewayError('currency must be a 3-letter ISO code');
          const enabled = input.enabled === undefined ? !!existingRow?.enabled : input.enabled === true;
          const missing = allowed.filter(name => !merged[name]);
          if (enabled && missing.length > 0) throw new GatewayError(`Provide ${missing.join(', ')} before enabling this provider`);

          const values = { enabled, currency, credentials_enc: this.cipher.encrypt(merged, aad(tenantId, provider)), updated_by: employeeId, updated_at: db.fn.now() };
          if (existingRow) await db(TENANT_GATEWAY_TABLE).where({ provider }).update(values);
          else await db(TENANT_GATEWAY_TABLE).insert({ provider, ...values });
          return this.view(provider, { enabled, currency, updated_at: new Date() }, merged);
     }

     async remove(tenantId: number, provider: GatewayProvider) {
          const db = await this.ensureSchema(tenantId);
          await db(TENANT_GATEWAY_TABLE).where({ provider }).delete();
     }
}

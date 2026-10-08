import IORedis from 'ioredis';
import { createHash } from 'crypto';
import logger from '../../hooks/logger';
import { configuration } from '../../hooks/configuration';
import { OptionalRedisCache } from './OptionalRedisCache';

function positiveInteger(name: string, fallback: number): number {
     const raw = process.env[name];
     if (raw === undefined || raw === '') return fallback;
     const value = Number(raw);
     if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
     return value;
}

const timeoutMs = positiveInteger('REDIS_CACHE_TIMEOUT_MS', 150);
const ttlSeconds = positiveInteger('TEST_PANEL_CACHE_TTL_SECONDS', 900);
const referenceTtlSeconds = positiveInteger('REFERENCE_DATA_CACHE_TTL_SECONDS', 1800);
const redisDb = Number(process.env.REDIS_DB || 0);
if (!Number.isSafeInteger(redisDb) || redisDb < 0) throw new Error('REDIS_DB must be a non-negative integer');


const production = process.env.NODE_ENV === 'production';
const databaseIdentity = createHash('sha256')
     .update(JSON.stringify(production
          ? [process.env.PRODUCTION_DB_HOSTNAME, process.env.PRODUCTION_DB_PORT, process.env.PRODUCTION_DATABASE]
          : [process.env.DB_HOST, process.env.DB_PORT, process.env.DATABASE]))
     .digest('hex').slice(0, 16);
const namespace = process.env.REDIS_CACHE_NAMESPACE || `lobnos:${databaseIdentity}:cache:v1`;


const enabled = process.env.REDIS_ENABLED !== 'false' && process.env.REDIS_CACHE_ENABLED !== 'false';



const client = new IORedis({
     host: process.env.REDIS_HOST || '127.0.0.1',
     port: positiveInteger('REDIS_PORT', 6379),
     password: process.env.REDIS_PASSWORD || undefined,
     db: redisDb,
     lazyConnect: true,
     enableOfflineQueue: false,
     maxRetriesPerRequest: 0,
     connectTimeout: timeoutMs,
     commandTimeout: timeoutMs,
     retryStrategy: (attempt) => Math.min(attempt * 1_000, 30_000),
});

export const optionalRedisCache = new OptionalRedisCache(client, {
     namespace,
     timeoutMs,
     warn: (message, error) => logger.warn(message, {
          error: error instanceof Error ? error.message : String(error),
     }),
});

let started = false;
let outageLogged = false;

// Warn once per outage; reconnect attempts while Redis stays down are silent.
function warnUnavailable(error: unknown): void {
     if (outageLogged) return;
     outageLogged = true;
     logger.warn('Optional Redis cache unavailable; using database', {
          error: error instanceof Error ? error.message : String(error),
     });
}

client.on('ready', () => {
     if (outageLogged) logger.info('Optional Redis cache connected');
     outageLogged = false;
     void optionalRedisCache.recover();
});
client.on('close', () => optionalRedisCache.disconnect());
client.on('error', (error) => {
     optionalRedisCache.disconnect();
     warnUnavailable(error);
});

export function startOptionalRedisCache(): void {
     if (!enabled || started) return;
     started = true;
     try {
          void client.connect().catch(warnUnavailable);
     } catch (error) {
          warnUnavailable(error);
     }
}

export function stopOptionalRedisCache(): void {
     optionalRedisCache.disconnect();
     client.disconnect();
     started = false;
}

function scope(tenantId: number): string {
     if (!Number.isSafeInteger(tenantId) || tenantId < 1) throw new Error('Invalid cache tenantId');
     return configuration.isMultiTenant ? `tenant:${tenantId}` : 'single-tenant';
}

function resourceCache(resource: string, expiration: number) {
     return {
          getOrLoad<T>(tenantId: number, view: string, parameters: Record<string, unknown>, loader: () => Promise<T>): Promise<T> {
               return optionalRedisCache.getOrLoad(scope(tenantId), resource, view, parameters, expiration, loader);
          },
          invalidate(tenantId: number): Promise<void> {
               return optionalRedisCache.invalidate(scope(tenantId), resource);
          },
     };
}

export const testPanelCache = resourceCache('test-panels', ttlSeconds);
export const branchCache = resourceCache('branches', referenceTtlSeconds);
// Department edits and master imports already invalidate the joined test-panel resource.
export const departmentCache = resourceCache('test-panels', referenceTtlSeconds);
export const companyInfoCache = resourceCache('company-info', referenceTtlSeconds);

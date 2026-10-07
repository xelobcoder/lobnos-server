import { createHash, randomBytes } from 'crypto';

export interface CacheRedisClient {
     readonly status: string;
     get(key: string): Promise<string | null>;
     set(key: string, value: string): Promise<unknown>;
     eval(script: string, numberOfKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

export interface CacheMetrics {
     hits: number;
     misses: number;
     bypasses: number;
     errors: number;
     invalidations: number;
     coalesced: number;
}

interface CacheOptions {
     namespace: string;
     timeoutMs: number;
     warn: (message: string, error: unknown) => void;
}

type EncodedValue =
     | { type: 'value'; value: string | number | boolean | null }
     | { type: 'undefined' }
     | { type: 'date'; value: string }
     | { type: 'array'; value: EncodedValue[] }
     | { type: 'object'; value: [string, EncodedValue][] };

function encode(value: unknown): EncodedValue {
     if (value === undefined) return { type: 'undefined' };
     if (value === null) return { type: 'value', value: null };
     if (typeof value === 'string' || typeof value === 'boolean') {
          return { type: 'value', value };
     }
     if (typeof value === 'number' && Number.isFinite(value)) return { type: 'value', value };
     if (value instanceof Date) return { type: 'date', value: value.toISOString() };
     if (Array.isArray(value)) return { type: 'array', value: value.map(encode) };
     if (typeof value === 'object' && !Buffer.isBuffer(value)) {
          return { type: 'object', value: Object.entries(value).map(([key, item]) => [key, encode(item)]) };
     }
     throw new Error('Unsupported cache value');
}

function decode(node: unknown): unknown {
     if (!node || typeof node !== 'object' || !('type' in node)) throw new Error('Invalid cache payload');
     const item = node as { type: unknown; value?: unknown };
     switch (item.type) {
          case 'undefined': return undefined;
          case 'value':
               if (item.value === null || typeof item.value === 'string' || typeof item.value === 'boolean'
                    || (typeof item.value === 'number' && Number.isFinite(item.value))) return item.value;
               break;
          case 'date':
               if (typeof item.value === 'string' && !Number.isNaN(Date.parse(item.value))) return new Date(item.value);
               break;
          case 'array':
               if (Array.isArray(item.value)) return item.value.map(decode);
               break;
          case 'object':
               if (Array.isArray(item.value)) {
                    const result: Record<string, unknown> = {};
                    for (const entry of item.value) {
                         if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') {
                              throw new Error('Invalid cache object');
                         }
                         Object.defineProperty(result, entry[0], {
                              value: decode(entry[1]), enumerable: true, writable: true, configurable: true,
                         });
                    }
                    return result;
               }
     }
     throw new Error('Invalid cache payload');
}

function normalize(value: unknown): unknown {
     if (Array.isArray(value)) return { type: 'array', value: value.map(normalize) };
     if (value instanceof Date) return encode(value);
     if (value && typeof value === 'object') {
          return { type: 'object', value: Object.keys(value).sort().map((key) => [key, normalize(value[key])]) };
     }
     return encode(value);
}

const token = () => randomBytes(16).toString('hex');
const GENERATION_SCRIPT = `
local epoch = redis.call('GET', KEYS[1])
if not epoch then
  epoch = ARGV[1]
  redis.call('SET', KEYS[1], epoch)
end
local generation = redis.call('GET', KEYS[2])
if not generation then
  generation = ARGV[2]
  redis.call('SET', KEYS[2], generation)
end
return {epoch, generation}`;
const PUBLISH_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] and redis.call('GET', KEYS[2]) == ARGV[2] then
  return redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4])
end
return 0`;

export class OptionalRedisCache {
     private available = false;
     private recovery?: Promise<void>;
     private lifecycle = 0;
     private lastWarning = 0;
     private readonly pending = new Map<string, Promise<unknown>>();
     private readonly counters: CacheMetrics = {
          hits: 0, misses: 0, bypasses: 0, errors: 0, invalidations: 0, coalesced: 0,
     };

     constructor(private readonly client: CacheRedisClient, private readonly options: CacheOptions) {}

     get metrics(): Readonly<CacheMetrics> {
          return { ...this.counters };
     }

     disconnect(): void {
          this.available = false;
          this.lifecycle++;
     }

     async recover(): Promise<void> {
          if (this.recovery) return this.recovery;
          if (this.client.status !== 'ready') return;
          const lifecycle = this.lifecycle;
          this.available = false;
          this.recovery = (async () => {
               try {
                    // A fresh shared epoch retires entries left by offline writes or a previous process.
                    await this.bounded(this.client.set(this.epochKey, token()));
                    if (lifecycle === this.lifecycle && this.client.status === 'ready') this.available = true;
               } catch (error) {
                    this.failed(error);
               }
          })();
          try {
               await this.recovery;
          } finally {
               this.recovery = undefined;
          }
     }

     async invalidate(scope: string, resource: string): Promise<void> {
          this.counters.invalidations++;
          if (!this.available || this.client.status !== 'ready') {
               this.disconnect();
               return;
          }
          try {
               await this.bounded(this.client.set(this.generationKey(scope, resource), token()));
          } catch (error) {
               this.failed(error);
          }
     }

     async getOrLoad<T>(
          scope: string,
          resource: string,
          view: string,
          parameters: Record<string, unknown>,
          ttlSeconds: number,
          loader: () => Promise<T>
     ): Promise<T> {
          if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1) throw new Error('Invalid cache TTL');
          if (!this.available || this.client.status !== 'ready') {
               this.counters.bypasses++;
               if (this.client.status === 'ready') void this.recover();
               return loader();
          }

          const lifecycle = this.lifecycle;
          const generationKey = this.generationKey(scope, resource);
          let epoch: string;
          let generation: string;
          let key: string;
          try {
               const state = await this.bounded(this.client.eval(GENERATION_SCRIPT, 2,
                    this.epochKey, generationKey, token(), token()));
               if (!Array.isArray(state) || state.length !== 2 || state.some((value) => typeof value !== 'string')) {
                    throw new Error('Invalid cache generation');
               }
               [epoch, generation] = state;
               const hash = createHash('sha256').update(JSON.stringify(normalize({ view, parameters }))).digest('hex');
               key = `${generationKey}:${epoch}:${generation}:${hash}`;
               const raw = await this.bounded(this.client.get(key));
               if (!this.available || lifecycle !== this.lifecycle) {
                    this.counters.bypasses++;
                    return loader();
               }
               if (raw !== null) {
                    const envelope: unknown = JSON.parse(raw);
                    if (!envelope || typeof envelope !== 'object' || !('version' in envelope)
                         || envelope.version !== 1 || !('data' in envelope)) throw new Error('Invalid cache envelope');
                    const data = decode(envelope.data) as T;
                    this.counters.hits++;
                    return data;
               }
          } catch (error) {
               this.failed(error);
               this.counters.bypasses++;
               return loader();
          }

          const existing = this.pending.get(key);
          if (existing) {
               this.counters.coalesced++;
               return existing as Promise<T>;
          }
          this.counters.misses++;
          const load = (async () => {
               const data = await loader();
               if (this.available && lifecycle === this.lifecycle && this.client.status === 'ready') {
                    try {
                         const payload = JSON.stringify({ version: 1, data: encode(data) });
                         await this.bounded(this.client.eval(PUBLISH_SCRIPT, 3,
                              this.epochKey, generationKey, key, epoch, generation, payload, ttlSeconds));
                    } catch (error) {
                         this.failed(error);
                    }
               }
               return data;
          })();
          this.pending.set(key, load);
          try {
               return await load;
          } finally {
               this.pending.delete(key);
          }
     }

     private get epochKey(): string {
          return `${this.options.namespace}:epoch`;
     }

     private generationKey(scope: string, resource: string): string {
          return `${this.options.namespace}:${scope}:${resource}:generation`;
     }

     private failed(error: unknown): void {
          this.counters.errors++;
          this.disconnect();
          const now = Date.now();
          if (now - this.lastWarning >= 30_000) {
               this.lastWarning = now;
               this.options.warn('Optional Redis cache unavailable; using database', error);
          }
     }

     private async bounded<T>(operation: Promise<T>): Promise<T> {
          let timer: ReturnType<typeof setTimeout>;
          try {
               return await Promise.race([
                    operation,
                    new Promise<never>((_resolve, reject) => {
                         timer = setTimeout(() => reject(new Error('Cache operation timed out')), this.options.timeoutMs);
                    }),
               ]);
          } finally {
               clearTimeout(timer);
          }
     }
}

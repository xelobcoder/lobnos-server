import IORedis from 'ioredis';
import logger from '../../hooks/logger';

let redisUnavailableLogged = false;

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

console.info('[Redis] Selected connection target', {
     host: redisHost,
     port: redisPort,
     passwordConfigured: Boolean(redisPassword),
     envOverride: Boolean(process.env.REDIS_HOST || process.env.REDIS_PORT),
});

export const redisConnection = new IORedis({
     host: redisHost,
     port: redisPort,
     password: redisPassword,
     maxRetriesPerRequest: null,
     lazyConnect: true,
     retryStrategy: (times) => Math.min(times * 500, 10_000),
});

redisConnection.on('connect', () => {
     console.info('[Redis] Connection attempt started', {
          host: redisHost,
          port: redisPort,
          status: redisConnection.status,
     });
});

redisConnection.on('error', (error) => {
     console.warn('[Redis] Connection failed or unavailable', {
          host: redisHost,
          port: redisPort,
          status: redisConnection.status,
          error: error?.message || String(error),
     });

     if (!redisUnavailableLogged) {
          logger.warn('Accounting Redis connection unavailable, falling back to periodic DB sweep only', {
               host: redisHost,
               port: redisPort,
               error: error?.message || String(error),
          });
          redisUnavailableLogged = true;
     }
});

redisConnection.on('ready', () => {
     redisUnavailableLogged = false;
     console.info('[Redis] Ready and connected', {
          host: redisHost,
          port: redisPort,
          status: redisConnection.status,
     });
});

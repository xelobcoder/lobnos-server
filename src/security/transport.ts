import { readFileSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { Express, RequestHandler } from 'express';

export function configureTransport(app: Express): void {
     // Trust addresses, never arbitrary hop counts or forwarded headers from every client.
     const proxies = (process.env.HTTPS_TRUSTED_PROXIES || 'loopback').split(',').map(value => value.trim()).filter(Boolean);
     if (proxies.some(value => ['true', 'false'].includes(value) || /^\d+$/.test(value))) {
          throw new Error('HTTPS_TRUSTED_PROXIES must contain proxy addresses or CIDRs');
     }
     app.set('trust proxy', proxies);
     app.use(httpsBoundary());
}

export function httpsBoundary(): RequestHandler {
     const required = process.env.HTTPS_REQUIRED === 'true' || process.env.PLS_ENCRYPTION_REQUIRED === 'true';
     const allowLoopback = process.env.HTTPS_ALLOW_LOOPBACK_HTTP === 'true' || process.env.PLS_DESKTOP_STANDALONE === 'true';
     return (req, res, next) => {
          if (req.secure) {
               res.setHeader('Strict-Transport-Security', 'max-age=31536000');
               return next();
          }
          const address = req.socket.remoteAddress;
          const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address || '');
          // A forwarded request must satisfy the HTTPS requirement even when its proxy is local.
          if (required && !(allowLoopback && loopback && !req.headers['x-forwarded-for'] && !req.headers['x-forwarded-proto'])) {
               res.setHeader('Cache-Control', 'no-store');
               res.status(426).json({ status: false, code: 'HTTPS_REQUIRED', message: 'A secure HTTPS connection is required.' });
               return;
          }
          next();
     };
}

export function applicationServer(app: Express) {
     if (process.env.HTTPS_ENABLED !== 'true') return createHttpServer(app);
     if (!process.env.SSL_CERT_PATH || !process.env.SSL_KEY_PATH) {
          throw new Error('HTTPS_ENABLED requires SSL_CERT_PATH and SSL_KEY_PATH');
     }
     return createHttpsServer({
          cert: readFileSync(process.env.SSL_CERT_PATH),
          key: readFileSync(process.env.SSL_KEY_PATH),
          minVersion: 'TLSv1.2',
     }, app);
}

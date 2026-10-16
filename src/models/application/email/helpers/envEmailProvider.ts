import { EmailProviderRecord } from '../types/EmailModels';

/**
 * Platform-wide fallback sender built from the environment. Used ONLY when a facility has no email
 * provider configured of its own. Returns null when the environment is not configured.
 *   PROD_PLS_EMAIL_USER / PROD_PLS_EMAIL_PASSWORD  (required)
 *   PROD_PLS_EMAIL_PROVIDER (e.g. gmail; used as host when PROD_PLS_EMAIL_HOST is absent, default gmail)
 *   PROD_PLS_EMAIL_HOST, PROD_PLS_EMAIL_PORT, PROD_PLS_EMAIL_SECURE, PROD_PLS_EMAIL_COMPANY (optional)
 */
export function getEnvEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProviderRecord | null {
     const user = env.PROD_PLS_EMAIL_USER?.trim();
     const password = env.PROD_PLS_EMAIL_PASSWORD;
     if (!user || !password) return null;

     const host = env.PROD_PLS_EMAIL_HOST?.trim() || env.PROD_PLS_EMAIL_PROVIDER?.trim() || 'gmail';
     const port = Number(env.PROD_PLS_EMAIL_PORT) > 0 ? Number(env.PROD_PLS_EMAIL_PORT) : 587;

     return {
          name: 'Environment default',
          provider_type: 'smtp',
          host,
          port,
          secure: env.PROD_PLS_EMAIL_SECURE === 'true',
          username: user,
          password,
          from_email: user,
          from_name: env.PROD_PLS_EMAIL_COMPANY?.trim() || 'Prime Laboratory Software',
          is_default: false,
          is_active: true,
     };
}

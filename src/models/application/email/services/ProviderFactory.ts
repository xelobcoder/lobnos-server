import { EmailProviderRecord } from '../types/EmailModels';
import { IEmailProvider } from '../interfaces/IEmailProvider';
import { SmtpEmailProvider } from './providers/SmtpEmailProvider';

function normalizeSmtpHost(host: string): string {
     const normalized = (host || '').trim().toLowerCase();

     if (normalized === 'gmail' || normalized === 'gmail.com' || normalized === 'googlemail.com') {
          return 'smtp.gmail.com';
     }

     return normalized;
}

function shouldUseSecure(port: number, configuredSecure: boolean): boolean {
     if (port === 587) return false;
     if (port === 465) return true;
     return Boolean(configuredSecure);
}

function normalizeSmtpUsername(username: string, host: string, fromEmail: string): string {
     const normalizedUsername = (username || '').trim();
     const isGmailHost = host === 'smtp.gmail.com';
     const looksLikeEmail = normalizedUsername.includes('@');

     if (isGmailHost && !looksLikeEmail) {
          return fromEmail;
     }

     return normalizedUsername;
}

export class ProviderFactory {
     create(provider: EmailProviderRecord): IEmailProvider {
          switch (provider.provider_type) {
               case 'smtp': {
                    const host = normalizeSmtpHost(provider.host);
                    const port = Number(provider.port);
                    const secure = shouldUseSecure(port, Boolean(provider.secure));
                    const username = normalizeSmtpUsername(provider.username, host, provider.from_email);

                    return new SmtpEmailProvider({
                         host,
                         port,
                         secure,
                         username,
                         password: provider.password,
                    });
               }
               default:
                    throw new Error(`Unsupported email provider type: ${provider.provider_type}`);
          }
     }
}

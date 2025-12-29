import KnexConnection from "../../../database/KnexConnections";
import crypto from 'crypto';

export interface PrimeWindowAccess {
     id: number;
     start_period: Date;
     end_period: Date;
     window_days: number;
     islicensedRenewed: boolean;
     loginDurationPerUser: number;
}

export default class PrimeWindowAccessRepository {
     private connection;
     private tableName: string = 'prime_window_access';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private hashDate(date: Date): string {
          const text = date.toISOString();
          const algorithm = 'aes-256-cbc';
          const key = crypto.scryptSync(process.env.PRIME_WINDOWS_KEY!, 'salt', 32);
          const iv = crypto.randomBytes(16);
          const cipher = (crypto.createCipheriv as any)(algorithm, key, iv);
          let encrypted = cipher.update(text, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          return iv.toString('hex') + ':' + encrypted;
     }

     private dehashDate(encrypted: string): Date {
          const parts = encrypted.split(':');
          if (parts.length === 2) {
               // Try AES decryption
               try {
                    const algorithm = 'aes-256-cbc';
                    const key = crypto.scryptSync(process.env.PRIME_WINDOWS_KEY!, 'salt', 32);
                    const iv = Buffer.from(parts.shift()!, 'hex');
                    const encryptedText = Buffer.from(parts.join(':'), 'hex');
                    const decipher = (crypto.createDecipheriv as any)(algorithm, key, iv);
                    let decrypted: any = decipher.update(encryptedText);
                    decrypted = Buffer.concat([decrypted, decipher.final()]);
                    return new Date(decrypted.toString());
               } catch (e) {
                    throw new Error('AES decryption failed');
               }
          } else {
               // Fallback to old base64 method
               try {
                    const decoded = atob(encrypted);
                    const replaced = decoded.replace(process.env.PRIME_WINDOWS_KEY!, '');
                    return new Date(replaced);
               } catch (e2) {
                    throw new Error('Failed to dehash date');
               }
          }
     }

     async getCurrentWindow(): Promise<PrimeWindowAccess | null> {
          const connection = await this.connection;
          const window = await connection(this.tableName)
               .orderBy('id', 'desc')
               .first();
          if (window) {
               window.start_period = this.dehashDate(window.start_period as string);
               window.end_period = this.dehashDate(window.end_period as string);
          }
          return window;
     }

     async validateLicense(): Promise<boolean> {
          const window = await this.getCurrentWindow();
          if (!window) return false;
          const now = new Date();
          const start = new Date(window.start_period);
          const end = new Date(window.end_period);
          const gracePeriodEnd = new Date(end.getTime() + window.window_days * 24 * 60 * 60 * 1000);

          if (window.islicensedRenewed) {
               return now >= start && now <= end;
          } else {
               return now >= end && now <= gracePeriodEnd;
          }
     }

     async createWindow(startPeriod: Date, endPeriod: Date, windowDays: number = 3, islicensedRenewed: boolean = false, loginDurationPerUser: number = 6): Promise<number> {
          const connection = await this.connection;
          const [id] = await connection(this.tableName).insert({
               start_period: this.hashDate(startPeriod),
               end_period: this.hashDate(endPeriod),
               window_days: windowDays,
               islicensedRenewed: islicensedRenewed,
               loginDurationPerUser: loginDurationPerUser
          });
          return id;
     }

     async updateWindow(id: number, updates: Partial<Omit<PrimeWindowAccess, 'id'>>): Promise<void> {
          const connection = await this.connection;
          await connection(this.tableName).where({ id }).update(updates);
     }

     async checkDuplicateYearPeriod(startPeriod: Date, endPeriod: Date): Promise<boolean> {
          const connection = await this.connection;
          const windows = await connection(this.tableName).where('islicensedRenewed', true);
          const startYear = startPeriod.getFullYear();
          const endYear = endPeriod.getFullYear();
          for (const w of windows) {
               const wStart = this.dehashDate(w.start_period);
               const wEnd = this.dehashDate(w.end_period);
               if (wStart.getFullYear() === startYear && wEnd.getFullYear() === endYear) {
                    return true;
               }
          }
          return false;
     }
}
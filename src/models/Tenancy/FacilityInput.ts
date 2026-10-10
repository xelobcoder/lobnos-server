import { validateModuleConfiguration } from './FacilityModules';
import type { FacilityModuleConfiguration } from './FacilityModules';

export class FacilityError extends Error {
     constructor(message: string, public statusCode = 400) { super(message); }
}

export interface FacilityInput {
     companyName: string;
     email: string;
     phone: string;
     address: string;
     countryId: number;
     stateId: number;
     districtId: number;
     adminName: string;
     adminEmail: string;
     adminPassword: string;
     licenseDays: number;
     street: string;
     gpsAddress: string;
     moduleConfiguration: FacilityModuleConfiguration | null;
}

/** Limits reflect companyprofile, branch and roles, not just the wider registry columns. */
export function validateFacilityInput(body: unknown): FacilityInput {
     if (!body || typeof body !== 'object' || Array.isArray(body)) throw new FacilityError('A facility object is required');
     const value = body as Record<string, unknown>;
     const result: any = {};
     for (const [field, max] of Object.entries({
          companyName: 100, email: 100, phone: 10, address: 200, adminName: 100, adminEmail: 200,
     })) {
          if (typeof value[field] !== 'string' || !value[field].trim() || value[field].trim().length > max) {
               throw new FacilityError(`${field} is required and must be at most ${max} characters`);
          }
          result[field] = value[field].trim();
     }
     for (const field of ['email', 'adminEmail']) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result[field])) throw new FacilityError(`${field} must be a valid email`);
          result[field] = result[field].toLowerCase();
     }
     if (!/^\d{7,10}$/.test(result.phone)) throw new FacilityError('phone must contain 7–10 digits (roles.mobile schema limit)');
     if (Number(result.phone) > 4294967295) throw new FacilityError('phone exceeds the branch.contact unsigned integer storage limit');
     for (const field of ['countryId', 'stateId', 'districtId']) {
          if (typeof value[field] !== 'number' || !Number.isSafeInteger(value[field]) || Number(value[field]) <= 0) {
               throw new FacilityError(`${field} must be a positive integer`);
          }
          result[field] = value[field];
     }
     if (typeof value.adminPassword !== 'string' || value.adminPassword.length < 12 || Buffer.byteLength(value.adminPassword, 'utf8') > 72) {
          throw new FacilityError('adminPassword must be at least 12 characters and at most 72 UTF-8 bytes');
     }
     result.adminPassword = value.adminPassword;
     const days = value.licenseDays === undefined ? 365 : value.licenseDays;
     if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 3650) {
          throw new FacilityError('licenseDays must be an integer between 1 and 3650');
     }
     result.licenseDays = days;
     for (const field of ['street', 'gpsAddress']) {
          const text = value[field] === undefined ? '' : value[field];
          if (typeof text !== 'string' || text.trim().length > 100) throw new FacilityError(`${field} must be at most 100 characters`);
          result[field] = text.trim();
     }
     result.moduleConfiguration = validateModuleConfiguration(value.moduleConfiguration);
     return result;
}

import PrimeWindowAccessRepository from '../models/settings/users/PrimeWindowAccessRepository';
import { LicenseError, tenantId } from './certificate';
import { licenseMode } from './storage';
import { OfflineLicenseService } from './service';

/** Separate from HTTP middleware so background processors do not import routers/authentication. */
export async function requireOperationalLicense(id: number): Promise<void> {
     if (licenseMode() === 'legacy') return;
     tenantId(id);
     const status = await new OfflineLicenseService().status(id);
     if (!status.signedValid) {
          const reason = status.reason || 'LICENSE_INVALID';
          const unavailable = /PUBLIC_KEY|STORAGE|STATE_INVALID|DEVICE_UNAVAILABLE|CLOCK_INVALID/.test(reason);
          throw new LicenseError(reason, unavailable ? 503 : 403);
     }
     try {
          if (!await new PrimeWindowAccessRepository(id).validateLicense()) throw new LicenseError('LICENSE_EXISTING_WINDOW_INVALID');
     } catch (e) {
          if (e instanceof LicenseError) throw e;
          throw new LicenseError('LICENSE_EXISTING_WINDOW_UNAVAILABLE', 503);
     }
}

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { DEFAULT_COUNTRY_ISO, WEST_AFRICA_COUNTRIES, type AdministrativeDivision, type CountryRecord } from './WestAfricaGeographyData';

export interface PhoneValidationResult {
     valid: boolean;
     country: string;
     e164?: string;
     international?: string;
     national?: string;
     message?: string;
}

const byIso = new Map(WEST_AFRICA_COUNTRIES.map((country) => [country.iso2, country]));
const byCallingCode = new Map(WEST_AFRICA_COUNTRIES.map((country) => [country.phone.callingCode, country]));

export class GeographyService {
     static listCountries(): CountryRecord[] {
          return WEST_AFRICA_COUNTRIES;
     }

     static getCountry(iso2?: string | null): CountryRecord | undefined {
          return byIso.get(String(iso2 ?? '').trim().toUpperCase());
     }

     static getCountryByCallingCode(code?: string | null): CountryRecord | undefined {
          const digits = String(code ?? '').replace(/\D/g, '');
          return digits ? byCallingCode.get(`+${digits}`) : undefined;
     }

     static getDefaultCountry(): CountryRecord {
          return byIso.get(DEFAULT_COUNTRY_ISO)!;
     }

     static getDivisions(iso2: string): AdministrativeDivision[] | undefined {
          return this.getCountry(iso2)?.divisions;
     }

     static isValidDivision(iso2: string, name: string): boolean {
          const wanted = name.trim().toLowerCase();
          return !!this.getDivisions(iso2)?.some((division) => division.name.toLowerCase() === wanted);
     }

     // Accepts national (with or without trunk prefix) or international input and returns the E.164 form.
     static validatePhone(iso2: string, input: unknown): PhoneValidationResult {
          const country = this.getCountry(iso2);
          if (!country) return { valid: false, country: String(iso2), message: 'Unsupported country' };
          const raw = String(input ?? '').trim();
          const parsed = parsePhoneNumberFromString(raw.replace(/^00/, '+'), iso2.toUpperCase() as CountryCode);
          if (!parsed || !parsed.isValid() || parsed.country !== country.iso2) {
               return { valid: false, country: country.iso2, message: `Enter a valid ${country.name} phone number` };
          }
          return {
               valid: true,
               country: country.iso2,
               e164: parsed.number,
               international: parsed.formatInternational(),
               national: parsed.formatNational(),
          };
     }
}

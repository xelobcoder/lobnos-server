import { Transform } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';
import { GeographyService } from '../../geography/GeographyService';
import { DEFAULT_COUNTRY_ISO } from '../../geography/WestAfricaGeographyData';

// Ghana (or no country code) keeps the legacy 10-digit local format (0XXXXXXXXX) stored by registration.
// Other West African countries are validated by libphonenumber and stored as international digits (E.164 without '+').
function foreignCountry(codeValue: unknown) {
     const country = GeographyService.getCountryByCallingCode(codeValue as string);
     return country && country.iso2 !== DEFAULT_COUNTRY_ISO ? country : undefined;
}

export function RegistrationPhone(countryCodeField: string, validationOptions?: ValidationOptions) {
     return function (target: object, propertyName: string) {
          Transform(({ value, obj }) => {
               const country = foreignCountry(obj?.[countryCodeField]);
               if (!country || typeof value !== 'string' || !value.trim()) return value;
               const result = GeographyService.validatePhone(country.iso2, value);
               return result.valid ? result.e164!.slice(1) : value;
          })(target, propertyName);

          registerDecorator({
               name: 'registrationPhone',
               target: target.constructor,
               propertyName,
               options: validationOptions,
               constraints: [countryCodeField],
               validator: {
                    validate(value: unknown, args) {
                         if (value === undefined || value === null || value === '') return true;
                         const country = foreignCountry((args.object as any)[countryCodeField]);
                         if (!country) return typeof value === 'string' && /^\d{10}$/.test(value);
                         return typeof value === 'string' && GeographyService.validatePhone(country.iso2, `+${value}`).valid;
                    },
                    defaultMessage(args) {
                         const country = foreignCountry((args?.object as any)?.[countryCodeField]);
                         return country
                              ? `${args?.property} must be a valid ${country.name} phone number`
                              : `${args?.property} must contain exactly 10 digits`;
                    },
               },
          });
     };
}

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { GeographyService } from './GeographyService';
import { WEST_AFRICA_COUNTRIES } from './WestAfricaGeographyData';
import { divisionCodes } from './FacilityLocation';
import { UpdatePatientDto } from '../patients/dto/updatePatientDto';

describe('West Africa geography', () => {
     it('contains the 16 UN West Africa countries with unique calling codes', () => {
          expect(WEST_AFRICA_COUNTRIES).toHaveLength(16);
          expect(new Set(WEST_AFRICA_COUNTRIES.map((c) => c.phone.callingCode)).size).toBe(16);
          expect(GeographyService.getCountry('GH')?.phone.callingCode).toBe('+233');
          expect(GeographyService.getCountry('ML')?.phone.callingCode).toBe('+223');
          expect(GeographyService.getDivisions('GH')).toHaveLength(16);
          expect(GeographyService.getDivisions('NG')).toHaveLength(37);
     });

     it('normalizes national and international numbers to E.164', () => {
          expect(GeographyService.validatePhone('GH', '055 024 0202').e164).toBe('+233550240202');
          expect(GeographyService.validatePhone('NG', '+234 802 123 4567').e164).toBe('+2348021234567');
          expect(GeographyService.validatePhone('NG', '12345').valid).toBe(false);
     });

     it('validates patient phones per selected country while keeping Ghana legacy format', async () => {
          const check = async (body: object) => validate(plainToInstance(UpdatePatientDto, body), { skipMissingProperties: true });
          const ng = plainToInstance(UpdatePatientDto, { mobile_country_code: '+234', mobile_number: '08021234567' });
          expect(await validate(ng, { skipMissingProperties: true })).toHaveLength(0);
          expect(ng.mobile_number).toBe('2348021234567');
          expect((await check({ mobile_country_code: '+234', mobile_number: '0802' })).length).toBeGreaterThan(0);
          expect(await check({ mobile_country_code: '+233', mobile_number: '0550240202' })).toHaveLength(0);
          expect((await check({ mobile_country_code: '+233', mobile_number: '550240202' })).length).toBeGreaterThan(0);
     });

     it('generates unique two-letter region codes for every division', () => {
          for (const country of WEST_AFRICA_COUNTRIES) {
               const codes = divisionCodes(country);
               expect(codes).toHaveLength(country.divisions.length);
               expect(new Set(codes).size).toBe(codes.length);
          }
     });
});

import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { DEFAULT_COUNTRY_ISO, WEST_AFRICA_COUNTRIES, type CountryRecord } from './WestAfricaGeographyData';
import { GeographyService } from './GeographyService';
import { companyInfoCache } from '../../services/cache/testPanelCache';

export interface FacilityLocation {
     countryCode: string;
     state: string | null;
}

// Ghana's legacy regions keep their own codes; every other country gets <ISO2><2 letters> region codes.
export function divisionCodes(country: CountryRecord): string[] {
     const used = new Set<string>();
     return country.divisions.map((division, index) => {
          const letters = division.name.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
          const candidates: string[] = [];
          for (let i = 0; i < letters.length; i++) for (let j = i + 1; j < letters.length; j++) candidates.push(letters[i] + letters[j]);
          const pair = candidates.find((candidate) => !used.has(candidate)) ?? String(index + 10);
          used.add(pair);
          return pair;
     });
}

const ensured = new Set<string>();

// Existing tenant databases predate country support, so the columns are added on first use.
export async function ensureGeographyColumns(connection: Knex, cacheKey?: string): Promise<void> {
     if (cacheKey && ensured.has(cacheKey)) return;
     if (await connection.schema.hasTable('companyprofile')) {
          if (!(await connection.schema.hasColumn('companyprofile', 'country_code'))) {
               await connection.schema.alterTable('companyprofile', (table) => table.string('country_code', 2).notNullable().defaultTo(DEFAULT_COUNTRY_ISO));
          }
          if (!(await connection.schema.hasColumn('companyprofile', 'state'))) {
               await connection.schema.alterTable('companyprofile', (table) => table.string('state', 120).nullable());
          }
     }
     if (await connection.schema.hasTable('regions') && !(await connection.schema.hasColumn('regions', 'country_code'))) {
          await connection.schema.alterTable('regions', (table) => table.string('country_code', 2).notNullable().defaultTo(DEFAULT_COUNTRY_ISO));
     }
     if (cacheKey) ensured.add(cacheKey);
}

// Each non-Ghana division becomes a region with one default district so patient-id generation keeps working.
export async function seedWestAfricaRegions(connection: Knex): Promise<void> {
     if (!(await connection.schema.hasTable('regions')) || !(await connection.schema.hasTable('districts'))) return;
     for (const country of WEST_AFRICA_COUNTRIES) {
          if (country.iso2 === DEFAULT_COUNTRY_ISO) continue;
          const existing = await connection('regions').where({ country_code: country.iso2 }).count({ count: '*' }).first();
          if (Number(existing?.count) > 0) continue;
          const codes = divisionCodes(country);
          for (const [index, division] of country.divisions.entries()) {
               const regioncode = `${country.iso2}${codes[index]}`;
               await connection('regions').insert({ name: division.name, regioncode, country_code: country.iso2 }).onConflict('regioncode').ignore();
               const region = await connection('regions').where({ regioncode }).first('id');
               if (!region) continue;
               await connection('districts')
                    .insert({ name: division.name, code: codes[index], regionid: region.id })
                    .onConflict(['code', 'regionid']).ignore();
          }
     }
}

export async function getFacilityLocation(tenantId: number): Promise<FacilityLocation> {
     const connection = await KnexConnection(tenantId);
     await ensureGeographyColumns(connection, String(tenantId));
     const row = await connection.schema.hasTable('companyprofile')
          ? await connection('companyprofile').first('country_code', 'state')
          : undefined;
     const country = GeographyService.getCountry(row?.country_code) ?? GeographyService.getDefaultCountry();
     return { countryCode: country.iso2, state: row?.state ?? null };
}

export class FacilityLocationError extends Error {}

export async function setFacilityLocation(tenantId: number, input: { countryCode?: string; state?: string | null }): Promise<FacilityLocation> {
     const country = GeographyService.getCountry(input.countryCode);
     if (!country) throw new FacilityLocationError('Country not supported');
     const state = input.state ? String(input.state).trim() : null;
     if (state && !GeographyService.isValidDivision(country.iso2, state)) {
          throw new FacilityLocationError(`${state} is not a ${country.divisionLabel.toLowerCase()} of ${country.name}`);
     }
     const connection = await KnexConnection(tenantId);
     await ensureGeographyColumns(connection, String(tenantId));
     if (!(await connection.schema.hasTable('companyprofile'))) {
          throw new FacilityLocationError('Save the company profile before choosing a country');
     }
     const updated = await connection('companyprofile').update({ country_code: country.iso2, state });
     if (!updated) throw new FacilityLocationError('Save the company profile before choosing a country');
     await companyInfoCache.invalidate(tenantId);
     return { countryCode: country.iso2, state };
}

import type { Request, Response } from 'express';
import { GeographyService } from '../../models/geography/GeographyService';
import { customError } from '../../hooks/helper';
import { FacilityLocationError, getFacilityLocation, setFacilityLocation } from '../../models/geography/FacilityLocation';

const ok = (response: Response, message: string, result: unknown) =>
     response.status(200).json({ status: 'success', statusCode: 200, message, result });

export const listCountriesHandler = (_request: Request, response: Response) => {
     const countries = GeographyService.listCountries().map(({ divisions, ...country }) => ({
          ...country,
          divisionCount: divisions.length,
          isDefault: country.iso2 === GeographyService.getDefaultCountry().iso2,
     }));
     return ok(response, 'Countries retrieved', countries);
};

export const getCountryHandler = (request: Request, response: Response) => {
     const country = GeographyService.getCountry(String(request.params.iso2));
     if (!country) return customError('Country not supported', 404, response);
     return ok(response, 'Country retrieved', country);
};

export const listDivisionsHandler = (request: Request, response: Response) => {
     const country = GeographyService.getCountry(String(request.params.iso2));
     if (!country) return customError('Country not supported', 404, response);
     return ok(response, 'Administrative divisions retrieved', { label: country.divisionLabel, divisions: country.divisions });
};

export const getPhoneRulesHandler = (request: Request, response: Response) => {
     const country = GeographyService.getCountry(String(request.params.iso2));
     if (!country) return customError('Country not supported', 404, response);
     return ok(response, 'Phone rules retrieved', country.phone);
};

export const validatePhoneHandler = (request: Request, response: Response) => {
     const { country, phone } = request.body ?? {};
     if (!country || !phone) return customError('country and phone are required', 400, response);
     const result = GeographyService.validatePhone(String(country), phone);
     return response.status(result.valid ? 200 : 400).json({
          status: result.valid ? 'success' : 'error',
          statusCode: result.valid ? 200 : 400,
          message: result.valid ? 'Phone number is valid' : result.message,
          result,
     });
};

const tenantIdOf = (request: Request) => {
     const tenantId = parseInt(String(request.query.tenantId ?? ''), 10);
     return Number.isInteger(tenantId) && tenantId >= 0 ? tenantId : null;
};

export const getFacilityLocationHandler = async (request: Request, response: Response) => {
     const tenantId = tenantIdOf(request);
     if (tenantId === null) return customError('A valid tenantId is required', 400, response);
     try {
          const location = await getFacilityLocation(tenantId);
          const country = GeographyService.getCountry(location.countryCode)!;
          return ok(response, 'Facility location retrieved', { ...location, country });
     } catch (error) {
          return customError('Unable to load facility location', 500, response);
     }
};

export const updateFacilityLocationHandler = async (request: Request, response: Response) => {
     const tenantId = tenantIdOf(request);
     if (tenantId === null) return customError('A valid tenantId is required', 400, response);
     try {
          const location = await setFacilityLocation(tenantId, { countryCode: request.body?.countryCode, state: request.body?.state });
          return ok(response, 'Facility location updated', { ...location, country: GeographyService.getCountry(location.countryCode) });
     } catch (error) {
          if (error instanceof FacilityLocationError) return customError(error.message, 400, response);
          return customError('Unable to update facility location', 500, response);
     }
};
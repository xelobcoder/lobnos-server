import express from 'express';
import { checkTokenExists, isAuthorizedRoleAdmin } from '../../middleware/validateTenancy';
import { getFacilityLocationHandler, updateFacilityLocationHandler, getCountryHandler, getPhoneRulesHandler, listCountriesHandler, listDivisionsHandler, validatePhoneHandler } from './GeographyController';

const router = express.Router();

router.get('/api/v1/geography/countries', listCountriesHandler);
router.get('/api/v1/geography/facility', getFacilityLocationHandler);
router.put('/api/v1/geography/facility', checkTokenExists, isAuthorizedRoleAdmin, updateFacilityLocationHandler);
router.post('/api/v1/geography/phone/validate', validatePhoneHandler);
router.get('/api/v1/geography/countries/:iso2/divisions', listDivisionsHandler);
router.get('/api/v1/geography/countries/:iso2/phone-rules', getPhoneRulesHandler);
router.get('/api/v1/geography/countries/:iso2', getCountryHandler);

export default router;

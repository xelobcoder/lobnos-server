import express from 'express';
import {
     createClinicianPackageHandler,
     getClinicianPackagesHandler,
     updateClinicianPackageHandler,
     deleteClinicianPackageHandler,
     createOrganizationPackageHandler,
     getOrganizationPackagesHandler,
     updateOrganizationPackageHandler,
     deleteOrganizationPackageHandler,
     createPackageHandler,
     getPackagesHandler,
     updatePackageHandler,
     deletePackageHandler,
     createPackageTestHandler,
     getPackageTestsHandler,
     updatePackageTestHandler,
     deletePackageTestHandler,
     verifyAndLoadPackagesHandler
} from './packagesHandlers';
import { handleOverLoad } from '../../../hooks/helper';
import { packageConfigurationHandler } from './configurationHandlers';

const router = express.Router();

router.get('/api/v1/packages/:id/configuration', packageConfigurationHandler);
router.post('/api/v1/packages/configuration', packageConfigurationHandler);
router.put('/api/v1/packages/:id/configuration', packageConfigurationHandler);

router.post('/api/v1/clinician-packages', createClinicianPackageHandler);
router.get('/api/v1/clinician-packages/:id?', getClinicianPackagesHandler);
router.put('/api/v1/clinician-packages/:id', updateClinicianPackageHandler);
router.delete('/api/v1/clinician-packages/:id', deleteClinicianPackageHandler);

router.post('/api/v1/organization-packages', handleOverLoad(createOrganizationPackageHandler));
router.get('/api/v1/organization-packages/:id?', getOrganizationPackagesHandler);
router.put('/api/v1/organization-packages/:id', updateOrganizationPackageHandler);
router.delete('/api/v1/organization-packages/:id', deleteOrganizationPackageHandler);

router.post('/api/v1/packages', createPackageHandler);
router.get('/api/v1/packages/:id?/:page?/:count?', getPackagesHandler);
router.put('/api/v1/packages/:id', updatePackageHandler);
router.delete('/api/v1/packages/:id', deletePackageHandler);

router.post('/api/v1/package-tests', handleOverLoad(createPackageTestHandler));
router.get('/api/v1/package-tests/:id?', getPackageTestsHandler);
router.put('/api/v1/package-tests/:id', updatePackageTestHandler);
router.delete('/api/v1/package-tests/:id', deletePackageTestHandler);

router.post("/api/v1/packages/billing/verify/load", handleOverLoad(verifyAndLoadPackagesHandler))

export default router;

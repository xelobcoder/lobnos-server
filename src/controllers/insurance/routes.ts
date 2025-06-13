import express from 'express';
import {
     createInsurance,
     getAllInsurances,
     getInsuranceById,
     updateInsurance,
     deleteInsurance
} from './insuranceHandler';

const router = express.Router();

router.post('/api/v1/insurances', createInsurance);
router.get('/api/v1/insurances', getAllInsurances);
router.get('/api/v1/insurances/:insuranceId', getInsuranceById);
router.put('/api/v1/insurances/:insuranceId', updateInsurance);
router.delete('/api/v1/insurances/:insuranceId', deleteInsurance);

export default router;

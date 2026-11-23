import { Router } from 'express';
import { requireBusinessConfigurationRole, requireQcConfigurationRole } from '../../middleware/businessConfigurationAuthority';
import { listTestInstrumentMappings, saveTestInstrumentMapping, testInstrumentMappingHistory } from './TestInstrumentMappingController';

// Register after checkTokenExists. The authenticated tenant, never the body, selects the connection.
const router = Router();
router.use('/api/v1/test-instrument-mappings', requireQcConfigurationRole);
router.get('/api/v1/test-instrument-mappings', listTestInstrumentMappings);
router.get('/api/v1/test-instrument-mappings/:testid/history', testInstrumentMappingHistory);
router.put('/api/v1/test-instrument-mappings/:testid', requireBusinessConfigurationRole(['admin', 'manager']), saveTestInstrumentMapping);
export default router;

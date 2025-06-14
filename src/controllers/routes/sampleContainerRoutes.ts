import express from 'express';
import {
  createContainer,
  getAllContainers,
  getContainerById,
  updateContainer,
  deleteContainer,
  getReusableContainers,
  getContainersByMaterial
} from '../samplecontainer/SampleContainerController';
import { handleOverLoad } from '../../hooks/helper';

const router = express.Router();

router.post('/api/v1/sample/containers', handleOverLoad(createContainer));
router.get('/api/v1/sample/containers', handleOverLoad(getAllContainers));
router.get('/api/v1/sample/containers/:id',handleOverLoad( getContainerById));
router.put('/api/v1/sample/containers/:id', handleOverLoad(updateContainer));
router.delete('/api/v1/sample/containers/:id', handleOverLoad(deleteContainer));
router.get('/api/v1/sample/containers/reusable', handleOverLoad(getReusableContainers));
router.get('/api/v1/sample/containers/material/:material', handleOverLoad(getContainersByMaterial));

export default router;
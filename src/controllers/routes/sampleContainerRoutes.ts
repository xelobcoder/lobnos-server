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

const router = express.Router();

router.post('/api/v1/sample/containers', createContainer);
router.get('/api/v1/sample/containers', getAllContainers);
router.get('/api/v1/sample/containers/:id', getContainerById);
router.put('/api/v1/sample/containers/:id', updateContainer);
router.delete('/api/v1/sample/containers/:id', deleteContainer);
router.get('/api/v1/sample/containers/reusable', getReusableContainers);
router.get('/api/v1/sample/containers/material/:material', getContainersByMaterial);

export default router;
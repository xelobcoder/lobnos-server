import express from 'express';
import path from 'path';
import createFileUploader, { patientImageRoot } from '../../models/uploads/fileuploads';
export { validStoragePaths } from '../../models/uploads/fileuploads';

const router = express.Router();
const fileUploader = createFileUploader(patientImageRoot, path.join(__dirname, '../../public/uploads/patients'));

router.post('/api/v1/storage/prime/uploads', fileUploader.authorizeUpload, fileUploader.uploadSingle, fileUploader.handleUpload);
router.get('/api/v1/patients/images', fileUploader.getImagePath);
// Preserve the old double-slash path as well as the canonical URL.
router.get(['/api/v1/patient/images/:filename', '/api/v1//patient/images/:filename'], fileUploader.getImage);

export default router;

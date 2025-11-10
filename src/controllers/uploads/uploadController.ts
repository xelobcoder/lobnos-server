import express from 'express';
import path from 'path';
import { updatePatientImageHandler } from '../registration/PatientsHandler';
import { sendFileResponse } from '../../hooks/utility';
import createFileUploader from '../../models/uploads/fileuploads';

const router = express.Router();
const baseurl = `/api/v1/`
const uploadDir = path.join(__dirname, '../../public/uploads')

const fileUploader = createFileUploader(uploadDir);

export const validStoragePaths = ['patients', 'receipts']

router.post(`${baseurl}storage/prime/uploads`,
     fileUploader.getMulterMiddleware().single('file'),
     fileUploader.handleUpload,
     updatePatientImageHandler
);

router.post('/storage/prime/uploads/multiple',
     // updatePatientImageHandler
     // fileUploader.getMulterMiddleware().array('files', 5),
     // fileUploader.handleUpload
);



router.get(`${baseurl}/patient/images/:filename`, (req, res) => {
     const { filename } = req.params;
     const filePath = path.join(__dirname, '../../public/uploads/patients', filename);
     sendFileResponse(filePath, res);
});

export default router;

import { Request, Response, Router } from 'express';
import { ExcelHelper } from '../../utils/ExcelHelper';
import multer from 'multer';
import { Readable } from 'stream';
import { handleOverLoad } from '../../hooks/helper';

const storage = multer.memoryStorage();
const upload = multer({ storage });
const router = Router();


router.post('/api/v1/parse-excel', upload.single('file'), handleOverLoad(async (req: Request, res: Response) => {
     try {
          if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
          const { target } = req.body;
          const allowedTargets = ['clinician', 'organization', 'registration', 'outsource'];
          if (!target || !allowedTargets.includes(target)) {
               return res.status(400).json({ error: `Target is required and must be one of: ${allowedTargets.join(', ')}` });
          }
          const excel = new ExcelHelper();
          const { header, data } = await excel.parseBuffer(req.file.buffer, target);
          const validation = await excel.loadAndFilterValidData(req.file.buffer, target);
          res.json({ header, data, target, validation });
     } catch (err: any) {
          res.status(500).json({ error: 'Failed to parse Excel', details: err.message });
     }
}));

export default router;

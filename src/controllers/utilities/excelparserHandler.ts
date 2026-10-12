
import { Request, Response, Router } from 'express';
import { ExcelHelper, ExcelImportLimitError } from '../../utils/ExcelHelper';
import multer, { MulterError } from 'multer';
import { handleOverLoad } from '../../hooks/helper';

const storage = multer.memoryStorage();
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_WORKSHEET_ROWS = 20_001;
const MAX_WORKSHEET_COLUMNS = 100;
const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES } });
const router = Router();

const uploadExcel = (req: Request, res: Response, next: (error?: unknown) => void) => {
     upload.single('file')(req, res, (error: unknown) => {
          if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
               return res.status(413).json({ error: `Excel file exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB upload limit` });
          }
          next(error);
     });
};

router.post('/api/v1/parse-excel', uploadExcel, handleOverLoad(async (req: Request, res: Response) => {
     try {
          if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
          const { target } = req.body;
          const allowedTargets = ['clinician', 'organization', 'registration', 'outsource'];
          if (!target || !allowedTargets.includes(target)) {
               return res.status(400).json({ error: `Target is required and must be one of: ${allowedTargets.join(', ')}` });
          }
          const excel = new ExcelHelper();
          const { header, data } = await excel.parseBuffer(req.file.buffer, 2, {
               maxRows: MAX_WORKSHEET_ROWS,
               maxColumns: MAX_WORKSHEET_COLUMNS,
          });
          const validation = await excel.filterValidData(data, target);
          res.json({ header, data, target, validation });
     } catch (err: any) {
          if (err instanceof ExcelImportLimitError) {
               return res.status(413).json({ error: err.message });
          }
          res.status(500).json({ error: 'Failed to parse Excel', details: err.message });
     }
}));

export default router;

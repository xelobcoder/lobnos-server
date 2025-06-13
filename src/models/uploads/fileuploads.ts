import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer, { FileFilterCallback } from 'multer';
import { validStoragePaths } from '../../controllers/uploads/uploadController';

function createFileUploader(storagePath?: string) {
     const uploadDir = storagePath ? storagePath : path.resolve(__dirname, '../../public/uploads');

     function ensureUploadDirExists(dirPath?: string): void {
          const targetDir = dirPath ? path.resolve(uploadDir, dirPath) : uploadDir;
          if (!fs.existsSync(targetDir)) {
               fs.mkdirSync(targetDir, { recursive: true });
          }
     }

     const storage = multer.diskStorage({
          destination: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
               const targetDir = uploadDir;
               cb(null, targetDir);
          },
          filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
               const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
               cb(null, uniqueSuffix + path.extname(file.originalname));
          }
     });

     function getMulterMiddleware() {
          let targetDir = uploadDir;
          return multer({
               storage: multer.diskStorage({
                    destination: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
                         const category = (req as any).query.category as string;
                         targetDir = category ? path.join(uploadDir, category) : uploadDir;
                         ensureUploadDirExists(targetDir);
                         cb(null, targetDir);
                    },
                    filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
                         const evaluation = (req as any).query.ptid as string ?? 'unknown';
                         const category = (req as any).query.category as string ?? 'unknown';
                         if (!validStoragePaths.includes(category)) {
                              cb(new Error('Invalid category specified'), '');
                              return;
                         }

                         if (fs.existsSync(targetDir)) {
                              const files = fs.readdirSync(targetDir);
                              files.forEach(file => {
                                   if (file.startsWith(`${category}_${evaluation}_`)) {
                                        fs.unlinkSync(path.join(targetDir, file));
                                   }
                              });
                         }

                         const newFilename = `${category}_${evaluation}_${Date.now()}${path.extname(file.originalname)}`;
                         cb(null, newFilename);
                    }
               }),
               fileFilter: (req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
                    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
                    if (allowedTypes.includes(file.mimetype)) {
                         cb(null, true);
                    } else {
                         cb(new Error('Invalid file type. Only images are allowed.'));
                    }
               }
          });
     }

     async function handleUpload(req: Request, res: Response, next: Function): Promise<void> {
          try {
               if (!req.file) {
                    throw new Error('No file uploaded');
               }
               req.query.savedFilename = req.file.filename;
               next();
          } catch (err: any) {
               res.status(500).json({
                    status: 'error',
                    message: err.message
               });
          }
     }

     return {
          getMulterMiddleware,
          handleUpload
     };
}

export default createFileUploader;
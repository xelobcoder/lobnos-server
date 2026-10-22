import { NextFunction, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import KnexConnection from '../../database/KnexConnections';
import { configuration } from '../../hooks/configuration';
import { validatedImageType } from './imageValidation';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const validStoragePaths = ['patients', 'receipts'] as const;
// Keep patient data outside Express's public directory.
export const patientImageRoot = path.resolve(process.cwd(), 'data', 'patient-images');
type Category = typeof validStoragePaths[number];
type Scope = { tenantId: number; patientId: number; category: Category };

/** Old public copies must not bypass the authenticated image route. */
export function blockPublicPatientImages(req: Request, res: Response, next: NextFunction): void {
     try {
          const pathname = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/')).toLowerCase();
          if (/^\/uploads\/(?:patients|receipts)(?:\/|$)/.test(pathname)) {
               res.sendStatus(404);
               return;
          }
          next();
     } catch { res.sendStatus(400); }
}

class ImageError extends Error {
     constructor(message: string, readonly status = 400) { super(message); }
}

function positiveId(value: unknown): number {
     if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
     if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
          throw new ImageError('Invalid patient or tenant identifier');
     }
     return Number(value);
}

function authenticatedTenant(req: Request): number {
     const tenantId = positiveId(req.query.tenantId);
     const actor = (req as any).authUser;
     if (!actor || Number(actor.tenantId) !== tenantId || !actor.employeeid || !actor.role ||
          ['patient', 'clinician'].includes(String(actor.role).toLowerCase())) {
          throw new ImageError('An authenticated staff session for this facility is required', 403);
     }
     return tenantId;
}

const filenamePattern = /^(patients|receipts)_t([1-9]\d*)_p([1-9]\d*)_[a-f0-9-]{36}\.(jpg|png|gif)$/;
function scopedPath(root: string, tenantId: number, filename: string): string | null {
     const match = filenamePattern.exec(filename);
     return match && Number(match[2]) === tenantId
          ? path.join(root, String(tenantId), match[1], filename) : null;
}

function fail(res: Response, error: unknown): void {
     const status = error instanceof ImageError ? error.status : 500;
     res.status(status).json({ status: 'error', message: error instanceof ImageError ? error.message : 'Unable to process patient image' });
}

export default function createFileUploader(storagePath = patientImageRoot, legacyPath?: string) {
     const uploadDir = path.resolve(storagePath);

     async function authorizeUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
          try {
               const tenantId = authenticatedTenant(req);
               const patientId = positiveId(req.query.patientid);
               if (req.query.ptid !== undefined && positiveId(req.query.ptid) !== patientId) {
                    throw new ImageError('Patient identifiers do not match');
               }
               const category = req.query.category;
               if (typeof category !== 'string' || !validStoragePaths.includes(category as Category)) {
                    throw new ImageError('Invalid category specified');
               }
               const db = await KnexConnection(tenantId);
               if (!await db('new_patients').where({ patientid: patientId }).first('patientid')) {
                    throw new ImageError('Patient not found in this facility', 404);
               }
               res.locals.patientImageScope = { tenantId, patientId, category } as Scope;
               next();
          } catch (error) { fail(res, error); }
     }

     function getMulterMiddleware() {
          return multer({
               storage: multer.memoryStorage(),
               limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10, parts: 11 },
               fileFilter: (_req, file, cb) => {
                    if (['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) cb(null, true);
                    else cb(new ImageError('Only JPEG, PNG and GIF images are allowed', 415));
               },
          });
     }

     const receive = getMulterMiddleware().single('file');
     function uploadSingle(req: Request, res: Response, next: NextFunction): void {
          receive(req, res, error => {
               if (error instanceof multer.MulterError) {
                    fail(res, new ImageError(error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : 'Invalid image upload', error.code === 'LIMIT_FILE_SIZE' ? 413 : 400));
               } else if (error) fail(res, error);
               else next();
          });
     }

     async function handleUpload(req: Request, res: Response): Promise<void> {
          let newPath: string | undefined;
          let committed = false;
          try {
               const scope: Scope = res.locals.patientImageScope;
               if (!scope || authenticatedTenant(req) !== scope.tenantId) throw new ImageError('Invalid upload scope', 403);
               if (!req.file?.buffer) throw new ImageError('No file uploaded');
               if (req.file.buffer.length > MAX_IMAGE_BYTES) throw new ImageError('Image must be 5 MB or smaller', 413);
               const type = validatedImageType(req.file.buffer);
               if (!type || type.mime !== req.file.mimetype) throw new ImageError('File content must be a valid JPEG, PNG or GIF image matching its type', 415);
               const { tenantId, patientId, category } = scope;
               const filename = `${category}_t${tenantId}_p${patientId}_${randomUUID()}.${type.extension}`;
               newPath = scopedPath(uploadDir, tenantId, filename)!;
               await fs.mkdir(path.dirname(newPath), { recursive: true });
               await fs.writeFile(newPath, req.file.buffer, { flag: 'wx', mode: 0o600 });
               const db = await KnexConnection(tenantId);
               const previous = await db.transaction(async trx => {
                    // Serialize replacements for the patient, including the first image insert.
                    if (!await trx('new_patients').where({ patientid: patientId }).forUpdate().first('patientid')) {
                         throw new ImageError('Patient not found in this facility', 404);
                    }
                    const old = await trx('patientimages').where({ patientid: patientId }).first('imagepath');
                    const previous = old?.imagepath as string | undefined;
                    if (old) await trx('patientimages').where({ patientid: patientId }).update({ imagepath: filename });
                    else await trx('patientimages').insert({ patientid: patientId, imagepath: filename });
                    return previous;
               });
               committed = true;
               // Never prefix-delete files or delete ambiguous legacy shared images.
               const oldReference = previous && filenamePattern.exec(previous);
               const oldPath = oldReference && Number(oldReference[3]) === patientId && scopedPath(uploadDir, tenantId, previous);
               if (oldPath) await fs.unlink(oldPath).catch(() => undefined);
               res.status(200).json({ status: 'success', message: 'Patient image updated successfully', imagePath: filename });
          } catch (error) {
               if (newPath && !committed) await fs.unlink(newPath).catch(() => undefined);
               fail(res, error);
          }
     }

     async function getImage(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = authenticatedTenant(req);
               const filename = req.params.filename;
               if (typeof filename !== 'string' || filename !== path.basename(filename) || /[\\/\x00]/.test(filename)) {
                    throw new ImageError('Image not found', 404);
               }
               let filePath = scopedPath(uploadDir, tenantId, filename);
               const parsed = filenamePattern.exec(filename);
               // Legacy shared files are only attributable on a single-tenant installation.
               if (!filePath && !configuration.isMultiTenant && legacyPath && /^patients_(?:\d+|unknown)_\d+\.(?:jpe?g|png|gif)$/i.test(filename)) {
                    filePath = path.join(legacyPath, filename);
               }
               if (!filePath) throw new ImageError('Image not found', 404);
               const db = await KnexConnection(tenantId);
               const query = db('patientimages as pi')
                    .join('new_patients as p', 'p.patientid', 'pi.patientid')
                    .where('pi.imagepath', filename);
               if (parsed) query.andWhere('pi.patientid', Number(parsed[3]));
               if (!await query.first('pi.patientid')) throw new ImageError('Image not found', 404);
               res.setHeader('Cache-Control', 'private, no-store');
               res.setHeader('X-Content-Type-Options', 'nosniff');
               res.sendFile(path.resolve(filePath), error => {
                    if (error && !res.headersSent) fail(res, new ImageError('Image not found', 404));
               });
          } catch (error) { fail(res, error); }
     }

     return { authorizeUpload, getMulterMiddleware, uploadSingle, handleUpload, getImage };
}

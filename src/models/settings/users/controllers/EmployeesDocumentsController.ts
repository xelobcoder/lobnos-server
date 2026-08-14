import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { EmployeesDocumentsRepository } from '../repositories';
import { PrimeSqlErrorHandler } from '../../../../hooks/utility';

const employeeDocumentsUploadDir = path.resolve(process.cwd(), 'public', 'uploads', 'employees-documents');
if (!fs.existsSync(employeeDocumentsUploadDir)) {
     fs.mkdirSync(employeeDocumentsUploadDir, { recursive: true });
}

export const employeeDocumentUpload = multer({
     storage: multer.diskStorage({
          destination: (_req, _file, cb) => cb(null, employeeDocumentsUploadDir),
          filename: (_req, file, cb) => {
               const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname)}`;
               cb(null, safeName);
          }
     }),
     limits: { fileSize: 20 * 1024 * 1024 },
     fileFilter: (_req, file, cb) => {
          const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
          const extension = path.extname(file.originalname).toLowerCase();
          if (allowedExtensions.includes(extension)) {
               return cb(null, true);
          }
          cb(new Error('Invalid file type. Allowed formats: PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX.'));
     }
});

const parseTenantId = (req: Request): number => {
     const tenantId = Number.parseInt(req.query.tenantId as string, 10);
     if (Number.isNaN(tenantId)) throw new Error('Invalid tenantId');
     return tenantId;
};

const parseId = (value: string | string[] | number | undefined): number => {
     const normalizedValue = Array.isArray(value) ? value[0] ?? '' : value;
     const id = Number.parseInt(String(normalizedValue ?? ''), 10);
     if (Number.isNaN(id)) throw new Error('Invalid id');
     return id;
};

const parseEmployeeId = (req: Request): number => {
     const rawEmployeeId = Array.isArray(req.params.employeeId)
          ? req.params.employeeId[0] ?? req.body.employeeId
          : req.params.employeeId ?? req.body.employeeId;
     const employeeId = Number.parseInt(String(rawEmployeeId ?? ''), 10);
     return employeeId;
};

const normalizeStoredDocumentPath = (storedPath?: string | null): string => {
     if (!storedPath) return '';

     const normalized = storedPath.replace(/\\/g, '/').replace(/^\.?\//, '');
     const withoutPublicRoot = normalized.startsWith('public/')
          ? normalized.replace(/^public\//, '')
          : normalized;

     const withoutUploadsRoot = withoutPublicRoot.startsWith('uploads/')
          ? withoutPublicRoot.replace(/^uploads\//, '')
          : withoutPublicRoot;

     return path.resolve(process.cwd(), 'public', 'uploads', withoutUploadsRoot.replace(/^\//, ''));
};

export class EmployeesDocumentsController {
     static async create(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDocumentsRepository(tenantId);
               const payload: Record<string, any> = { ...req.body };

               if (req.file) {
                    payload.employeeId = payload.employeeId ?? parseEmployeeId(req);
                    payload.fileName = req.file.originalname;
                    payload.filePath = path.posix.join('public', 'uploads', 'employees-documents', req.file.filename).replace(/\\/g, '/');
               }

               if (!payload.employeeId) {
                    payload.employeeId = parseEmployeeId(req);
               }

               const id = await repo.create(payload);
               return res.status(201).json({ status: 'success', statusCode: 201, message: 'Document created successfully', result: { id } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async listByEmployee(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDocumentsRepository(tenantId);
               const result = await repo.findByEmployeeId(parseEmployeeId(req));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Documents retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async getById(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDocumentsRepository(tenantId);
               const result = await repo.findById(parseId(req.params.id));
               if (!result) {
                    return res.status(404).json({ status: 'error', statusCode: 404, message: 'Document not found' });
               }
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Document retrieved successfully', result });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async download(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDocumentsRepository(tenantId);
               const document = await repo.findById(parseId(req.params.id));

               if (!document || !document.filePath) {
                    return res.status(404).json({ status: 'error', statusCode: 404, message: 'Document file not found' });
               }

               const absoluteFilePath = normalizeStoredDocumentPath(document.filePath);
               if (!fs.existsSync(absoluteFilePath)) {
                    return res.status(404).json({ status: 'error', statusCode: 404, message: 'Stored file does not exist' });
               }

               res.download(absoluteFilePath, document.fileName || path.basename(absoluteFilePath));
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async update(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDocumentsRepository(tenantId);
               const payload: Record<string, any> = { ...req.body };

               if (req.file) {
                    payload.fileName = req.file.originalname;
                    payload.filePath = path.posix.join('public', 'uploads', 'employees-documents', req.file.filename).replace(/\\/g, '/');
               }

               const affected = await repo.update(parseId(req.params.id), payload);
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Document updated successfully', result: { affectedRows: affected } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }

     static async remove(req: Request, res: Response) {
          try {
               const tenantId = parseTenantId(req);
               const repo = new EmployeesDocumentsRepository(tenantId);
               const affected = await repo.delete(parseId(req.params.id));
               return res.status(200).json({ status: 'success', statusCode: 200, message: 'Document deleted successfully', result: { affectedRows: affected } });
          } catch (error) {
               PrimeSqlErrorHandler.handleError(error as any, res);
          }
     }
}

export default EmployeesDocumentsController;

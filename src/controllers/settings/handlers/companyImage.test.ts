import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('./imageUpload', () => ({ uploadImageFile: mocks.upload }));
vi.mock('../../../models/settings/companyProfile', () => ({}));
vi.mock('../../../hooks/logger', () => ({ default: { error: vi.fn() } }));
vi.mock('../../../hooks/helper', () => ({
     customError: (message: string, status: number, res: any) => res.status(status).send({ status: 'error', statusCode: status, message }),
     responseError: (res: any) => res.status(500).send({ status: 'error' }),
}));

import { configuration } from '../../../hooks/configuration';
import { companyImageDirectory, companyImageRoot, companyImageTenantId, readCompanyImage } from '../../../models/settings/companyImageStorage';
import { getCompanyImageHandler, handleUploadCompanyImage } from './companyhandler';
import { requireCompanyImageAdmin } from './companyImageAccess';

describe('company images', () => {
     let root: string;
     const original = { ...configuration };
     const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
     const jpeg = Buffer.from([255, 216, 255, 1]);
     const response = () => ({
          status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(), setHeader: vi.fn(),
     });
     beforeEach(() => {
          vi.clearAllMocks();
          root = fs.mkdtempSync(path.join(os.tmpdir(), 'pls-company-image-'));
          vi.spyOn(process, 'cwd').mockReturnValue(root);
          configuration.isMultiTenant = true;
          configuration.defaultTenantId = 3;
     });
     afterEach(() => {
          vi.restoreAllMocks();
          Object.assign(configuration, original);
          fs.rmSync(root, { recursive: true, force: true });
     });
     function writeLogo(id: number, image = png) {
          fs.mkdirSync(companyImageDirectory(id), { recursive: true });
          fs.writeFileSync(path.join(companyImageDirectory(id), 'logo'), image);
     }
     function legacy() {
          fs.mkdirSync(companyImageRoot(), { recursive: true });
          fs.writeFileSync(path.join(companyImageRoot(), 'legacy.png'), png);
     }
     function upload(image = jpeg) {
          mocks.upload.mockImplementation(async (req, _res, directory) => {
               req.file = { path: path.join(directory, 'temporary.jpg') };
               fs.writeFileSync(req.file.path, image);
               return true;
          });
     }
     it.each([undefined, '', '0', '-1', '3junk', '../3', '3.1', ' 3 ', ['3'], {}, '9007199254740992'])(
          'rejects malformed/missing multi-tenant identity %j', async value => {
               expect(companyImageTenantId(value)).toBeNull();
               const res = response();
               await getCompanyImageHandler({ query: { tenantId: value } } as any, res as any);
               expect(res.status).toHaveBeenCalledWith(400);
               expect(fs.existsSync(companyImageRoot())).toBe(false);
          });
     it('uses legacy only for the default owner and does not create storage on a missing read', async () => {
          legacy();
          expect(readCompanyImage(3)?.image).toEqual(png);
          expect(readCompanyImage(4)).toBeNull();
          const res = response();
          await getCompanyImageHandler({ query: { tenantId: '4' } } as any, res as any);
          expect(res.status).toHaveBeenCalledWith(404);
          expect(fs.existsSync(companyImageDirectory(4))).toBe(false);
     });
     it('reads the requested tenant logo with actual MIME and no cache', async () => {
          legacy();
          writeLogo(3, jpeg);
          writeLogo(4, png);
          const res = response();
          await getCompanyImageHandler({ query: { tenantId: '4' } } as any, res as any);
          expect(res.send).toHaveBeenCalledWith(png);
          expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
          expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
          expect(readCompanyImage(3)?.image).toEqual(jpeg);
     });
     it('replaces only the requested tenant image and leaves the legacy owner untouched', async () => {
          legacy();
          writeLogo(3);
          writeLogo(4);
          upload();
          const res = response();
          await handleUploadCompanyImage({ query: { tenantId: '4' } } as any, res as any);
          expect(res.status).toHaveBeenCalledWith(200);
          expect(readCompanyImage(4)?.image).toEqual(jpeg);
          expect(readCompanyImage(3)?.image).toEqual(png);
          expect(fs.readFileSync(path.join(companyImageRoot(), 'legacy.png'))).toEqual(png);
          expect(fs.readdirSync(companyImageDirectory(4))).toEqual(['logo']);
     });
     it('does not remove the current image when upload fails or has invalid bytes', async () => {
          writeLogo(4);
          mocks.upload.mockRejectedValueOnce(new Error('test upload failure'));
          const req = { query: { tenantId: '4' } };
          await handleUploadCompanyImage(req as any, response() as any);
          expect(readCompanyImage(4)?.image).toEqual(png);
          upload(Buffer.from('not an image'));
          const res = response();
          await handleUploadCompanyImage(req as any, res as any);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(readCompanyImage(4)?.image).toEqual(png);
          expect(fs.readdirSync(companyImageDirectory(4))).toEqual(['logo']);
     });
     it('rejects malformed upload identity before creating a directory or invoking multer', async () => {
          const res = response();
          await handleUploadCompanyImage({ query: { tenantId: '../4' } } as any, res as any);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.upload).not.toHaveBeenCalled();
          expect(fs.existsSync(companyImageRoot())).toBe(false);
     });
     it('does not fall back to the shared image when a tenant logo is invalid', () => {
          legacy();
          writeLogo(3, Buffer.from('invalid'));
          expect(readCompanyImage(3)).toBeNull();
     });
     it('preserves single-tenant aliases and missing-tenant legacy compatibility', () => {
          configuration.isMultiTenant = false;
          legacy();
          expect(companyImageTenantId(undefined)).toBe(3);
          expect(companyImageTenantId('4')).toBe(3);
          expect(readCompanyImage(4)?.image).toEqual(png);
          writeLogo(4, jpeg);
          expect(readCompanyImage(3)?.image).toEqual(jpeg);
     });
     it.each([null, { role: 'patient', tenantId: 4 }, { role: 'admin', tenantId: 3 },
          { role: 'scientist', tenantId: 4 }])('rejects missing/unauthorized/cross-tenant upload actors %j', actor => {
          const res = response();
          const next = vi.fn();
          requireCompanyImageAdmin({ query: { tenantId: '4', employeeid: '1' }, authUser: actor } as any, res as any, next);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
     });
     it.each(['admin', 'super-admin'])('accepts a verified tenant %s without trusting query employeeid', role => {
          const next = vi.fn();
          requireCompanyImageAdmin({ query: { tenantId: '4' }, authUser: { role, tenantId: 4 } } as any, response() as any, next);
          expect(next).toHaveBeenCalledOnce();
     });
});

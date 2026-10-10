import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock('../../../models/settings/companyProfile', () => ({
     insertCompanyProfile: mocks.insert,
}));
vi.mock('../../../hooks/logger', () => ({ default: { error: vi.fn() } }));
vi.mock('./imageUpload', () => ({ uploadImageFile: vi.fn() }));
vi.mock('../../../hooks/helper', () => ({
     customError: (message: string, status: number, res: Response) =>
          res.status(status).send({ status: 'error', statusCode: status, message }),
     responseError: (res: Response) => res.status(500).send({ status: 'error' }),
}));

import { AddCompanyInfoHandler } from './companyhandler';

describe('company profile required fields', () => {
     const body = {
          name: 'Example Laboratory',
          email: 'staff@example.test',
          phonenumber: '0590000000',
          motto: '',
          address: 'Example address',
          website: null,
          street: '',
          alternativenumber: '',
          labTimings: '{"timings": []}',
          additionalInfo: '',
     };
     const response = () => ({
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis(),
     });
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.insert.mockResolvedValue(true);
     });
     it.each(['', 'Our laboratory motto'])('accepts motto %j and preserves the submitted body', async motto => {
          const submitted = { ...body, motto };
          const res = response();
          await AddCompanyInfoHandler({
               body: submitted, query: { tenantId: '344423' },
          } as unknown as Parameters<typeof AddCompanyInfoHandler>[0], res as unknown as Response);
          expect(mocks.insert).toHaveBeenCalledWith(344423, submitted);
          expect(res.send).toHaveBeenCalledWith({ status: 'success' });
          expect(res.status).not.toHaveBeenCalled();
     });
     it.each([
          { motto: undefined }, { motto: null }, { motto: 123 },
          { name: '' }, { email: '' }, { phonenumber: '' },
     ])('rejects missing or invalid required fields %j', async overrides => {
          const res = response();
          await AddCompanyInfoHandler({
               body: { ...body, ...overrides }, query: { tenantId: '344423' },
          } as unknown as Parameters<typeof AddCompanyInfoHandler>[0], res as unknown as Response);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.insert).not.toHaveBeenCalled();
     });
});

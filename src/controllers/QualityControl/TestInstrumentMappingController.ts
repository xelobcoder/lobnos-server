import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { TestInstrumentMapping } from '../../models/QualityControl/TestInstrumentMapping';

function pagination(req: Request) {
     const page = Number(req.query.page ?? 1), count = Number(req.query.count ?? 20);
     if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
          !Number.isSafeInteger(count) || count < 1 || count > 100)
          throw Object.assign(new Error('Invalid pagination'), { statusCode: 400 });
     return { page, count };
}
function respondError(res: Response, error: any) {
     const status = Number(error?.statusCode);
     return res.status(status >= 400 && status < 500 ? status : 500).json({
          status: 'error', statusCode: status >= 400 && status < 500 ? status : 500,
          message: status >= 400 && status < 500 ? error.message : 'Unable to process instrument mapping',
     });
}
export async function listTestInstrumentMappings(req: Request, res: Response) {
     try {
          const { page, count } = pagination(req);
          const search = req.query.search ?? '';
          if (typeof search !== 'string' || search.length > 100) throw Object.assign(new Error('Invalid search'), { statusCode: 400 });
          res.setHeader('Cache-Control', 'private, no-store');
          return res.json(await new TestInstrumentMapping(getAuthUser(req)!.tenantId).list(page, count, search.trim()));
     } catch (error) { return respondError(res, error); }
}
export async function testInstrumentMappingHistory(req: Request, res: Response) {
     try {
          const { page, count } = pagination(req);
          res.setHeader('Cache-Control', 'private, no-store');
          return res.json(await new TestInstrumentMapping(getAuthUser(req)!.tenantId).history(Number(req.params.testid), page, count));
     } catch (error) { return respondError(res, error); }
}
export async function saveTestInstrumentMapping(req: Request, res: Response) {
     try {
          const actor = getAuthUser(req)!;
          return res.json({ data: await new TestInstrumentMapping(actor.tenantId).save(Number(req.params.testid), actor.employeeid, req.body) });
     } catch (error) { return respondError(res, error); }
}

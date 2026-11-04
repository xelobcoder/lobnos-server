import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuthUser } from '../../../middleware/authority';
import logger from '../../../hooks/logger';
import { ResultReadySmsService } from '../../../models/application/sms/events/ResultReadySmsService';

const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const selection = z.object({
     ascensionids: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).min(1).max(100)
          .refine(ids => new Set(ids).size === ids.length, 'Select distinct ordered tests'),
     message: z.string().max(1000).optional(),
});
const confirmedSelection = selection.extend({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/) });
const querySchema = z.object({ billingid: id, patientid: id.optional(), page: id.max(100000).optional(), count: id.max(100).optional() });

function handler(action: 'workspace' | 'preview' | 'send' | 'history') {
     return async (req: Request, res: Response) => {
          const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ success: false, error: 'Authentication required' });
          const query = querySchema.safeParse(req.query);
          if (!query.success) return res.status(400).json({ success: false, error: query.error.issues[0].message });
          try {
               const service = new ResultReadySmsService(actor.tenantId);
               const { billingid, patientid, page, count } = query.data;
               let data: unknown;
               if (action === 'workspace') data = await service.workspace(actor, billingid, patientid);
               else if (action === 'history') data = await service.history(actor, billingid, page, count);
               else {
                    const input = (action === 'send' ? confirmedSelection : selection).safeParse(req.body);
                    if (!input.success) return res.status(400).json({ success: false, error: input.error.issues[0].message });
                    const ascensionids = input.data.ascensionids;
                    if (!ascensionids) return res.status(400).json({ success: false, error: 'Select ordered tests' });
                    if (action === 'send') {
                         const fingerprint = confirmedSelection.parse(input.data).fingerprint;
                         if (!fingerprint) return res.status(400).json({ success: false, error: 'Preview the message before sending' });
                         data = await service.send(actor, billingid, { ascensionids, message: input.data.message, fingerprint });
                    } else data = await service.preview(actor, billingid, { ascensionids, message: input.data.message });
               }
               return res.json({ success: true, data });
          } catch (error) {
               const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
               const message = error instanceof Error ? error.message : 'Unable to process result-ready SMS';
               logger.error('Result-ready SMS request failed', { action, billingid: query.data.billingid, status });
               return res.status(Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500).json({ success: false, error: message });
          }
     };
}

export const getResultReadySmsWorkspace = handler('workspace');
export const previewResultReadySms = handler('preview');
export const sendSelectedResultReadySms = handler('send');
export const getResultReadySmsHistory = handler('history');

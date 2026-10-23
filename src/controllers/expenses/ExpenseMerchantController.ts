import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuthUser } from '../../middleware/authority';
import ExpenseMerchants from '../../models/Expenses/expenseMerchants';

const merchantSchema = z.object({
     name: z.string().trim().min(1, 'Merchant name is required').max(255),
     email: z.string().trim().max(255).email().or(z.literal('')).optional(),
     phone: z.string().trim().regex(/^\d{10}$/, 'Phone number must contain 10 digits').or(z.literal('')).optional(),
     address: z.string().trim().max(255).optional(),
     website: z.string().trim().max(255).url().or(z.literal('')).optional(),
     notes: z.string().trim().max(5000).optional(),
});
const errorResponse = (res: Response, error: any) => res.status(error instanceof z.ZodError ? 400 : 500).json({
     status: 'error', message: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join('; ') : 'Unable to save merchant. Please try again.',
});

export async function createExpenseMerchant(req: Request, res: Response) {
     try {
          const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required' });
          if (actor.branch == null) return res.status(403).json({ status: 'error', message: 'Select an operating branch before creating a merchant.' });
          const input = merchantSchema.parse(req.body);
          const repo = new ExpenseMerchants(actor.tenantId);
          if (await repo.findByMerchantName(input.name)) return res.status(409).json({ status: 'error', message: 'A merchant with this name already exists.' });
          const merchant = await repo.create({ ...input, created_by: actor.employeeid });
          return res.status(201).json({ status: 'success', statusCode: 201, message: 'Merchant created successfully', merchant });
     } catch (error) { return errorResponse(res, error); }
}

export async function updateExpenseMerchant(req: Request, res: Response) {
     try {
          const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required' });
          const id = z.coerce.number().int().positive().parse(req.body.id);
          const input = merchantSchema.parse(req.body);
          const repo = new ExpenseMerchants(actor.tenantId);
          if (!await repo.findById(id)) return res.status(404).json({ status: 'error', message: 'Merchant not found' });
          const duplicate = await repo.findByMerchantName(input.name);
          if (duplicate && Number(duplicate.id) !== id) return res.status(409).json({ status: 'error', message: 'A merchant with this name already exists.' });
          await repo.update({ ...input, id, updated_by: actor.employeeid });
          return res.json({ status: 'success', message: 'Merchant updated successfully' });
     } catch (error) { return errorResponse(res, error); }
}

export async function getAllExpenseMerchants(req: Request, res: Response) {
     try {
          const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required' });
          const count = req.query.count == null ? 10 : Number(req.query.count);
          const page = req.query.page == null ? 1 : Number(req.query.page);
          if (!Number.isSafeInteger(count) || count < 1 || count > 500 || !Number.isSafeInteger(page) || page < 1) return res.status(400).json({ status: 'error', message: 'Choose a valid page and between 1 and 500 merchants per page.' });
          return res.json(await new ExpenseMerchants(actor.tenantId).findAll(count, page));
     } catch { return res.status(500).json({ status: 'error', message: 'Unable to load merchants. Please try again.' }); }
}

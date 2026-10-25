import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { getAuthUser } from '../../middleware/authority';
import { ModernBillingPreview } from '../../models/billing/ModernBillingPreview';

export async function previewModernBilling(request: Request, response: Response): Promise<void> {
    const actor = getAuthUser(request);
    if (!actor) { response.status(401).json({ success: false, message: 'Authentication required' }); return; }
    if (!actor.branch) { response.status(403).json({ success: false, message: 'An assigned branch is required' }); return; }
    try {
        const data = await new ModernBillingPreview().review(actor, request.body);
        response.json({ success: true, data });
    } catch (error: any) {
        response.status(400).json({ success: false, message: error instanceof ZodError ? error.issues[0]?.message || 'Invalid selection' : error.message || 'Unable to review this bill' });
    }
}

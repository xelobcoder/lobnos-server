"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartialSmsJobSchema = exports.CreateSmsJobSchema = exports.BaseSmsJobSchema = void 0;
const zod_1 = require("zod");
exports.BaseSmsJobSchema = zod_1.z.object({
    templateId: zod_1.z.number().optional(),
    customBody: zod_1.z.string().optional(), // <-- allow custom message
    category: zod_1.z.enum(['patient', 'clinician', 'organization']),
    recipientScope: zod_1.z.enum(['single', 'multiple', 'all']),
    targetIds: zod_1.z.any().optional(),
    sendType: zod_1.z.enum(['immediate', 'scheduled']),
    scheduledAt: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['pending', 'processing', 'sent', 'partialfailed', 'failed']).optional(),
    createdBy: zod_1.z.number(),
});
exports.CreateSmsJobSchema = exports.BaseSmsJobSchema.refine(data => data.templateId || data.customBody, {
    message: 'Either templateId or customBody is required',
    path: ['templateId', 'customBody'],
});
exports.PartialSmsJobSchema = exports.BaseSmsJobSchema.partial();

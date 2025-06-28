"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSmsJobRecipientSchema = void 0;
const zod_1 = require("zod");
exports.CreateSmsJobRecipientSchema = zod_1.z.object({
    jobId: zod_1.z.number(),
    phoneE164: zod_1.z.string().min(1),
    personalizedBody: zod_1.z.string().min(1),
    deliveryStatus: zod_1.z.enum(['queued', 'sent', 'failed', 'retrying']).optional(),
    sentAt: zod_1.z.string().datetime().optional(),
    errorCode: zod_1.z.string().optional(),
});

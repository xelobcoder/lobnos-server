"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSmsTemplateSchema = void 0;
const zod_1 = require("zod");
exports.CreateSmsTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1),
    category: zod_1.z.enum(['patient', 'clinician', 'organization']),
    createdBy: zod_1.z.number(),
});

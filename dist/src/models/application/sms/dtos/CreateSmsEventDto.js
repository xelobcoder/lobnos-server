"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSmsEventSchema = void 0;
const zod_1 = require("zod");
exports.CreateSmsEventSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    category: zod_1.z.enum(['patient', 'clinician', 'organization']),
});

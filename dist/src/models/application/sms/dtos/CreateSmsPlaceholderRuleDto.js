"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSmsPlaceholderRuleSchema = void 0;
const zod_1 = require("zod");
exports.CreateSmsPlaceholderRuleSchema = zod_1.z.object({
    category: zod_1.z.enum(['patient', 'clinician', 'organization']),
    placeholder: zod_1.z.string().min(1),
    columnName: zod_1.z.string().min(1),
    tableName: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
});

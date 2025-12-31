"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSmsCategoryMappingSchema = void 0;
const zod_1 = require("zod");
exports.CreateSmsCategoryMappingSchema = zod_1.z.object({
    category: zod_1.z.enum(['patient', 'clinician', 'organization']),
    tableName: zod_1.z.string().min(1),
    idColumn: zod_1.z.string().min(1),
    phoneColumn: zod_1.z.string().optional(),
    nameColumn: zod_1.z.string().optional(),
    additionalFields: zod_1.z.any().optional(),
});

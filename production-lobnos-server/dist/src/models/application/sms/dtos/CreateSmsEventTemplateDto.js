"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSmsEventTemplateSchema = void 0;
const zod_1 = require("zod");
exports.CreateSmsEventTemplateSchema = zod_1.z.object({
    eventId: zod_1.z.number(),
    templateId: zod_1.z.number(),
    isActive: zod_1.z.boolean().optional(),
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateLeadFollowUpSchema = exports.CreateLeadFollowUpSchema = exports.LeadFollowUpSchema = exports.UpdateLeadSchema = exports.CreateLeadSchema = exports.LeadSchema = void 0;
const zod_1 = require("zod");
exports.LeadSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    firstname: zod_1.z.string().min(1).max(255),
    lastname: zod_1.z.string().min(1).max(255),
    middlename: zod_1.z.string().max(255).optional(),
    contact_person: zod_1.z.string().min(1).max(255),
    contact_email: zod_1.z.string().email().max(255),
    contact_phone: zod_1.z.string().min(1).max(50),
    company_name: zod_1.z.string().max(255).optional(),
    industry_type: zod_1.z.enum(['healthcare', 'pharmaceutical', 'biotech', 'research']),
    lead_source: zod_1.z.enum(['website', 'referral', 'social_media', 'cold_call', 'trade_show']),
    service_interest: zod_1.z.string().optional(),
    status: zod_1.z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']),
    location: zod_1.z.string().min(1).max(255),
    assigned_to: zod_1.z.number().int().positive().optional(),
    notes: zod_1.z.string().optional(),
    created_at: zod_1.z.date(),
    updated_at: zod_1.z.date(),
    created_by: zod_1.z.number().int().positive().optional(),
});
exports.CreateLeadSchema = exports.LeadSchema.omit({ id: true, created_at: true, updated_at: true });
exports.UpdateLeadSchema = exports.CreateLeadSchema.partial();
exports.LeadFollowUpSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    lead_id: zod_1.z.number().int().positive(),
    followup_type: zod_1.z.enum(['call', 'email', 'meeting', 'visit', 'other']),
    followup_date: zod_1.z.string().optional(),
    notes: zod_1.z.string().min(1),
    next_followup_date: zod_1.z.string().optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']),
    status: zod_1.z.enum(['pending', 'completed', 'cancelled']),
    created_by: zod_1.z.number().int().positive().optional(),
    created_at: zod_1.z.date(),
    updated_at: zod_1.z.date(),
});
exports.CreateLeadFollowUpSchema = exports.LeadFollowUpSchema.omit({ id: true, created_at: true, updated_at: true });
exports.UpdateLeadFollowUpSchema = exports.CreateLeadFollowUpSchema.partial();

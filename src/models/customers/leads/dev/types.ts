
import { z } from 'zod';

export interface Lead {
    id: number;
    firstname: string;
    lastname: string;
    middlename?: string;
    contact_person: string;
    contact_email: string;
    contact_phone: string;
    company_name?: string;
    industry_type: 'healthcare' | 'pharmaceutical' | 'biotech' | 'research';
    lead_source: 'website' | 'referral' | 'social_media' | 'cold_call' | 'trade_show';
    service_interest?: string;
    status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    location: string;
    assigned_to?: number;
    notes?: string;
    created_at: Date;
    updated_at: Date;
    created_by?: number;
}

export interface LeadActivity {
    id: string;
    lead_id: string;
    type: 'call' | 'email' | 'meeting';
    description: string;
    activity_date: Date;
    user_id: string;
}

export interface LeadFollowUp {
    id: number;
    lead_id: number;
    followup_type: 'call' | 'email' | 'meeting' | 'visit' | 'other';
    followup_date?: string;
    notes: string;
    next_followup_date?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'completed' | 'cancelled';
    created_by?: number;
    created_at: Date;
    updated_at: Date;
}

export interface LeadConversion {
    id: string;
    lead_id: string;
    converted_to_client: boolean;
    client_id?: string;
    conversion_date?: Date;
}


export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

export const LeadSchema = z.object({
    id: z.number().int().positive(),
    firstname: z.string().min(1).max(255),
    lastname: z.string().min(1).max(255),
    middlename: z.string().max(255).optional(),
    contact_person: z.string().min(1).max(255),
    contact_email: z.string().email().max(255),
    contact_phone: z.string().min(1).max(50),
    company_name: z.string().max(255).optional(),
    industry_type: z.enum(['healthcare', 'pharmaceutical', 'biotech', 'research']),
    lead_source: z.enum(['website', 'referral', 'social_media', 'cold_call', 'trade_show']),
    service_interest: z.string().optional(),
    status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    location: z.string().min(1).max(255),
    assigned_to: z.number().int().positive().optional(),
    notes: z.string().optional(),
    created_at: z.date(),
    updated_at: z.date(),
    created_by: z.number().int().positive().optional(),
});

export const CreateLeadSchema = LeadSchema.omit({ id: true, created_at: true, updated_at: true });
export const UpdateLeadSchema = CreateLeadSchema.partial();

export const LeadFollowUpSchema = z.object({
    id: z.number().int().positive(),
    lead_id: z.number().int().positive(),
    followup_type: z.enum(['call', 'email', 'meeting', 'visit', 'other']),
    followup_date: z.string().optional(),
    notes: z.string().min(1),
    next_followup_date: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    status: z.enum(['pending', 'completed', 'cancelled']),
    created_by: z.number().int().positive().optional(),
    created_at: z.date(),
    updated_at: z.date(),
});

export const CreateLeadFollowUpSchema = LeadFollowUpSchema.omit({ id: true, created_at: true, updated_at: true });
export const UpdateLeadFollowUpSchema = CreateLeadFollowUpSchema.partial();

export interface Lead {
     id: string;
     name: string;
     contact_person: string;
     contact_email: string;
     contact_phone: string;
     company_name?: string;
     industry_type: string;
     lead_source: string;
     service_interest: string;
     status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
     priority: 'low' | 'medium' | 'high';
     location: string;
     assigned_to: string;
     notes?: string;
     created_at: Date;
     updated_at: Date;
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
     id: string;
     lead_id: string;
     scheduled_date: Date;
     reminder_sent: boolean;
     status: 'pending' | 'completed';
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
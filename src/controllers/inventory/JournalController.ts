import { Request, Response } from 'express';
import { ApiResponse } from '../../models/inventory/types';
import KnexConnection from '../../database/KnexConnections';
import { getAccountName } from '../../config/accountConfig';

export interface JournalEntry {
     id: string;
     account_id: string;
     account_name: string;
     debit_amount: number;
     credit_amount: number;
     line_description: string;
     reference_id?: string;
     reference_type?: string;
     entry_date: string;
     source_module: string;
     entry_status: string;
     posted_by?: string;
     posted_at?: string;
     created_at: string;
     updated_at: string;
}

export interface JournalFilters {
     page?: number;
     count?: number;
     account_id?: string;
     reference_id?: string;
     reference_type?: string;
     entry_status?: string;
     source_module?: string;
     startDate?: string;
     endDate?: string;
     sortby?: 'ASC' | 'DESC';
}

export interface JournalListResponse {
     entries: JournalEntry[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: string;
}

export class JournalController {
     private getTenantId(req: Request): number {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               throw new Error('Tenant ID is required');
          }
          return tenantId;
     }

     async getJournalEntries(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const filters: JournalFilters = {
                    page: parseInt(req.query.page as string) || 1,
                    count: parseInt(req.query.count as string) || 10,
                    account_id: req.query.account_id as string,
                    reference_id: req.query.reference_id as string,
                    reference_type: req.query.reference_type as string,
                    entry_status: req.query.entry_status as string,
                    source_module: req.query.source_module as string,
                    startDate: req.query.startDate as string,
                    endDate: req.query.endDate as string,
                    sortby: (req.query.sortby as 'ASC' | 'DESC') || 'DESC'
               };

               // For now, we'll use a simple query. In a real implementation,
               // you'd want to create a proper JournalModel class
               const connection = await KnexConnection(tenantId);

               let query = connection('acc_journal_entry_lines')
                    .select('*')
                    .orderBy('created_at', filters.sortby === 'ASC' ? 'asc' : 'desc');

               // Apply filters
               if (filters.account_id) {
                    query = query.where('account_id', filters.account_id);
               }
               if (filters.reference_id) {
                    query = query.where('reference_id', filters.reference_id);
               }
               if (filters.reference_type) {
                    query = query.where('reference_type', filters.reference_type);
               }
               if (filters.entry_status) {
                    query = query.where('entry_status', filters.entry_status);
               }
               if (filters.source_module) {
                    query = query.where('source_module', filters.source_module);
               }
               if (filters.startDate) {
                    query = query.where('entry_date', '>=', filters.startDate);
               }
               if (filters.endDate) {
                    query = query.where('entry_date', '<=', filters.endDate);
               }

               // Get total count for pagination
               const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
               const totalResult = await totalQuery;
               const total = parseInt(totalResult.count as string);

               // Apply pagination
               const offset = (filters.page! - 1) * filters.count!;
               query = query.limit(filters.count!).offset(offset);

               const entries = await query;

               const totalPages = Math.ceil(total / filters.count!);

               const result: JournalListResponse = {
                    entries: entries.map((entry: any) => ({
                         id: entry.id,
                         account_id: entry.account_id,
                         account_name: getAccountName(entry.account_id),
                         debit_amount: parseFloat(entry.debit_amount),
                         credit_amount: parseFloat(entry.credit_amount),
                         line_description: entry.line_description,
                         reference_id: entry.reference_id,
                         reference_type: entry.reference_type,
                         entry_date: entry.entry_date,
                         source_module: entry.source_module,
                         entry_status: entry.entry_status,
                         posted_by: entry.posted_by,
                         posted_at: entry.posted_at,
                         created_at: entry.created_at,
                         updated_at: entry.updated_at
                    })),
                    total,
                    page: filters.page!,
                    count: filters.count!,
                    totalPages,
                    sortby: filters.sortby!
               };

               const response: ApiResponse<JournalListResponse> = {
                    success: true,
                    message: 'Journal entries retrieved successfully',
                    data: result
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error retrieving journal entries:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to retrieve journal entries',
                    data: null
               };
               res.status(500).json(response);
          }
     }

     async getJournalEntryById(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const connection = await KnexConnection(tenantId);
               const entry = await connection('acc_journal_entry_lines')
                    .where('id', id)
                    .first();

               if (!entry) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Journal entry not found',
                         data: null
                    };
                    res.status(404).json(response);
                    return;
               }

               const journalEntry: JournalEntry = {
                    id: entry.id,
                    account_id: entry.account_id,
                    account_name: getAccountName(entry.account_id),
                    debit_amount: parseFloat(entry.debit_amount),
                    credit_amount: parseFloat(entry.credit_amount),
                    line_description: entry.line_description,
                    reference_id: entry.reference_id,
                    reference_type: entry.reference_type,
                    entry_date: entry.entry_date,
                    source_module: entry.source_module,
                    entry_status: entry.entry_status,
                    posted_by: entry.posted_by,
                    posted_at: entry.posted_at,
                    created_at: entry.created_at,
                    updated_at: entry.updated_at
               };

               const response: ApiResponse<JournalEntry> = {
                    success: true,
                    message: 'Journal entry retrieved successfully',
                    data: journalEntry
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error retrieving journal entry:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to retrieve journal entry',
                    data: null
               };
               res.status(500).json(response);
          }
     }
}
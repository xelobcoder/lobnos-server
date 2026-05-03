"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalController = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const accountConfig_1 = require("../../config/accountConfig");
class JournalController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    async getJournalEntries(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const filters = {
                page: parseInt(req.query.page) || 1,
                count: parseInt(req.query.count) || 10,
                account_id: req.query.account_id,
                reference_id: req.query.reference_id,
                reference_type: req.query.reference_type,
                entry_status: req.query.entry_status,
                source_module: req.query.source_module,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                sortby: req.query.sortby || 'DESC'
            };
            const connection = await (0, KnexConnections_1.default)(tenantId);
            let query = connection('acc_journal_entry_lines')
                .select('*')
                .orderBy('created_at', filters.sortby === 'ASC' ? 'asc' : 'desc');
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
            const total = parseInt(totalResult.count);
            // Apply pagination
            const offset = (filters.page - 1) * filters.count;
            query = query.limit(filters.count).offset(offset);
            const entries = await query;
            const totalPages = Math.ceil(total / filters.count);
            const result = {
                entries: entries.map((entry) => ({
                    id: entry.id,
                    account_id: entry.account_id,
                    account_name: (0, accountConfig_1.getAccountName)(entry.account_id),
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
                page: filters.page,
                count: filters.count,
                totalPages,
                sortby: filters.sortby
            };
            const response = {
                success: true,
                message: 'Journal entries retrieved successfully',
                data: result
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving journal entries:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve journal entries',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getJournalEntryById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const entry = await connection('acc_journal_entry_lines')
                .where('id', id)
                .first();
            if (!entry) {
                const response = {
                    success: false,
                    message: 'Journal entry not found',
                    data: null
                };
                res.status(404).json(response);
                return;
            }
            const journalEntry = {
                id: entry.id,
                account_id: entry.account_id,
                account_name: (0, accountConfig_1.getAccountName)(entry.account_id),
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
            const response = {
                success: true,
                message: 'Journal entry retrieved successfully',
                data: journalEntry
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving journal entry:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve journal entry',
                data: null
            };
            res.status(500).json(response);
        }
    }
}
exports.JournalController = JournalController;

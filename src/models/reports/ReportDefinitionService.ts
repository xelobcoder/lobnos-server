import { randomUUID } from 'crypto';
import KnexConnection from '../../database/KnexConnections';
import { normalizeReportInput, serializeReportInput } from './ReportCatalog';
import { ReportDefinitionInput, ReportValidationError, ReportVisibility } from './types';

export interface SavedReport {
     id: string;
     name: string;
     description: string | null;
     dataset: string;
     visibility: ReportVisibility;
     owner_employeeid: number;
     definition: ReportDefinitionInput;
     created_at: Date | string;
     updated_at: Date | string;
}

export interface SaveReportInput {
     name: string;
     description?: string | null;
     visibility?: ReportVisibility;
     definition: unknown;
}

const MAX_NAME = 160;
const MAX_DESCRIPTION = 500;

function cleanText(value: unknown, field: string, max: number, required: boolean): string | null {
     if (value === undefined || value === null) {
          if (required) throw new ReportValidationError(`${field} is required.`);
          return null;
     }
     if (typeof value !== 'string') throw new ReportValidationError(`${field} must be text.`);
     const text = value.trim();
     if (!text && required) throw new ReportValidationError(`${field} is required.`);
     if (text.length > max) throw new ReportValidationError(`${field} may contain at most ${max} characters.`);
     return text || null;
}

function cleanVisibility(value: unknown): ReportVisibility {
     if (value === undefined || value === null || value === '') return 'private';
     if (value !== 'private' && value !== 'facility') throw new ReportValidationError('visibility must be private or facility.');
     return value;
}

function mapRow(row: any): SavedReport | null {
     if (!row) return null;
     let definition: ReportDefinitionInput;
     try {
          definition = JSON.parse(String(row.definition_json));
     } catch {
          return null;
     }
     return {
          id: String(row.id),
          name: String(row.name),
          description: row.description === null || row.description === undefined ? null : String(row.description),
          dataset: String(row.dataset),
          visibility: row.visibility === 'facility' ? 'facility' : 'private',
          owner_employeeid: Number(row.owner_employeeid),
          definition,
          created_at: row.created_at,
          updated_at: row.updated_at,
     };
}

export class ReportDefinitionService {
     constructor(private readonly tenantId: number) { }

     private async db() {
          return KnexConnection(this.tenantId);
     }

     async list(employeeid: number): Promise<SavedReport[]> {
          const db = await this.db();
          const rows = await db('pls_report_definitions')
               .where({ is_active: true })
               .andWhere((builder) => builder.where({ owner_employeeid: employeeid }).orWhere({ visibility: 'facility' }))
               .orderBy([{ column: 'updated_at', order: 'desc' }, { column: 'created_at', order: 'desc' }])
               .limit(200);
          return (rows as any[]).map(mapRow).filter((row): row is SavedReport => row !== null);
     }

     async get(id: string, employeeid: number): Promise<SavedReport> {
          const db = await this.db();
          const row = await db('pls_report_definitions').where({ id, is_active: true }).first();
          const report = mapRow(row);
          if (!report) throw new ReportValidationError('Report not found.');
          if (report.visibility === 'private' && report.owner_employeeid !== employeeid) {
               throw new ReportValidationError('Report not found.');
          }
          return report;
     }

     async create(input: SaveReportInput, employeeid: number): Promise<SavedReport> {
          const name = cleanText(input.name, 'Name', MAX_NAME, true)!;
          const description = cleanText(input.description, 'Description', MAX_DESCRIPTION, false);
          const visibility = cleanVisibility(input.visibility);
          const normalized = normalizeReportInput(input.definition);
          const db = await this.db();
          const id = randomUUID();
          await db('pls_report_definitions').insert({
               id,
               name,
               description,
               dataset: normalized.dataset.id,
               definition_json: JSON.stringify(serializeReportInput(normalized)),
               visibility,
               owner_employeeid: employeeid,
               is_active: true,
          });
          return this.get(id, employeeid);
     }

     async update(id: string, input: SaveReportInput, employeeid: number, canManageAll: boolean): Promise<SavedReport> {
          const existing = await this.get(id, employeeid);
          if (existing.owner_employeeid !== employeeid && !canManageAll) {
               throw new ReportValidationError('Only the owner or an administrator can change this report.');
          }
          const name = cleanText(input.name, 'Name', MAX_NAME, true)!;
          const description = cleanText(input.description, 'Description', MAX_DESCRIPTION, false);
          const visibility = input.visibility === undefined || input.visibility === null
               ? existing.visibility
               : cleanVisibility(input.visibility);
          const normalized = normalizeReportInput(input.definition);
          const db = await this.db();
          await db('pls_report_definitions').where({ id }).update({
               name,
               description,
               dataset: normalized.dataset.id,
               definition_json: JSON.stringify(serializeReportInput(normalized)),
               visibility,
               updated_at: new Date(),
          });
          return this.get(id, employeeid);
     }

     async remove(id: string, employeeid: number, canManageAll: boolean): Promise<void> {
          const existing = await this.get(id, employeeid);
          if (existing.owner_employeeid !== employeeid && !canManageAll) {
               throw new ReportValidationError('Only the owner or an administrator can delete this report.');
          }
          const db = await this.db();
          await db('pls_report_definitions').where({ id }).update({ is_active: false, updated_at: new Date() });
     }
}

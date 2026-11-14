import { Request, Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';
import { getAuthUser } from '../../middleware/authority';
import { isSuperAdminRole, normalizeRole } from '../../middleware/roles';
import { normalizeReportInput, publicDatasetCatalog, serializeReportInput } from '../../models/reports/ReportCatalog';
import { ReportDefinitionService, SaveReportInput } from '../../models/reports/ReportDefinitionService';
import { executeReport, reportToCsv, reportToXlsx } from '../../models/reports/ReportQueryService';
import { ReportValidationError } from '../../models/reports/types';

function tenantOf(request: Request): number {
     const tenantId = Number(getAuthUser(request)?.tenantId);
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0) throw new ReportValidationError('Authenticated facility required.');
     return tenantId;
}

function employeeOf(request: Request): number {
     const employeeid = Number(getAuthUser(request)?.employeeid);
     if (!Number.isSafeInteger(employeeid) || employeeid <= 0) throw new ReportValidationError('Authenticated employee required.');
     return employeeid;
}

function canManageAll(request: Request): boolean {
     const role = getAuthUser(request)?.role;
     return isSuperAdminRole(role) || normalizeRole(role) === 'admin';
}

function fail(response: Response, error: unknown): void {
     if (error instanceof ReportValidationError) {
          response.status(400).json({ status: 'error', statusCode: 400, message: error.message });
          return;
     }
     logger.error('[Reports] Request failed', { error: (error as any)?.message || String(error) });
     response.status(500).json({ status: 'error', statusCode: 500, message: 'The report could not be completed. Please retry.' });
}

function fileStem(name: string): string {
     const stem = String(name || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
     return stem || 'report';
}

function requestedFormat(request: Request): 'csv' | 'xlsx' {
     const value = String(request.query.format ?? request.body?.format ?? 'xlsx').toLowerCase();
     if (value !== 'csv' && value !== 'xlsx') throw new ReportValidationError('format must be csv or xlsx.');
     return value;
}

async function sendExport(response: Response, tenantId: number, report: ReturnType<typeof normalizeReportInput>, title: string, format: 'csv' | 'xlsx') {
     const db = await KnexConnection(tenantId);
     const result = await executeReport(db, report);
     if (format === 'csv') {
          response.setHeader('Content-Type', 'text/csv; charset=utf-8');
          response.setHeader('Content-Disposition', `attachment; filename="${fileStem(title)}.csv"`);
          response.send(reportToCsv(result));
          return;
     }
     const buffer = await reportToXlsx(result, title);
     response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
     response.setHeader('Content-Disposition', `attachment; filename="${fileStem(title)}.xlsx"`);
     response.send(buffer);
}

export class ReportController {
     static datasets(_request: Request, response: Response) {
          response.json({ status: 'success', statusCode: 200, data: publicDatasetCatalog() });
     }

     static async preview(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               const normalized = normalizeReportInput(request.body?.definition ?? request.body);
               const db = await KnexConnection(tenantId);
               const result = await executeReport(db, normalized);
               response.json({
                    status: 'success',
                    statusCode: 200,
                    data: {
                         ...result,
                         dataset: normalized.dataset.id,
                         datasetLabel: normalized.dataset.label,
                         definition: serializeReportInput(normalized),
                    },
               });
          } catch (error) {
               fail(response, error);
          }
     }

     static async create(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               const employeeid = employeeOf(request);
               const service = new ReportDefinitionService(tenantId);
               const input: SaveReportInput = {
                    name: request.body?.name,
                    description: request.body?.description,
                    visibility: request.body?.visibility,
                    definition: request.body?.definition,
               };
               const report = await service.create(input, employeeid);
               response.status(201).json({ status: 'success', statusCode: 201, data: report });
          } catch (error) {
               fail(response, error);
          }
     }

     static async list(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               const reports = await new ReportDefinitionService(tenantId).list(employeeOf(request));
               response.json({ status: 'success', statusCode: 200, data: reports });
          } catch (error) {
               fail(response, error);
          }
     }

     static async get(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               const report = await new ReportDefinitionService(tenantId).get(String(request.params.id), employeeOf(request));
               response.json({ status: 'success', statusCode: 200, data: report });
          } catch (error) {
               fail(response, error);
          }
     }

     static async update(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               const employeeid = employeeOf(request);
               const service = new ReportDefinitionService(tenantId);
               const input: SaveReportInput = {
                    name: request.body?.name,
                    description: request.body?.description,
                    visibility: request.body?.visibility,
                    definition: request.body?.definition,
               };
               const report = await service.update(String(request.params.id), input, employeeid, canManageAll(request));
               response.json({ status: 'success', statusCode: 200, data: report });
          } catch (error) {
               fail(response, error);
          }
     }

     static async remove(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               await new ReportDefinitionService(tenantId).remove(String(request.params.id), employeeOf(request), canManageAll(request));
               response.json({ status: 'success', statusCode: 200, data: { removed: true } });
          } catch (error) {
               fail(response, error);
          }
     }

     static async run(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               const saved = await new ReportDefinitionService(tenantId).get(String(request.params.id), employeeOf(request));
               const normalized = normalizeReportInput(saved.definition);
               const db = await KnexConnection(tenantId);
               const result = await executeReport(db, normalized);
               response.json({
                    status: 'success',
                    statusCode: 200,
                    data: { ...result, dataset: normalized.dataset.id, datasetLabel: normalized.dataset.label, name: saved.name },
               });
          } catch (error) {
               fail(response, error);
          }
     }

     static async exportSaved(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               const saved = await new ReportDefinitionService(tenantId).get(String(request.params.id), employeeOf(request));
               const normalized = normalizeReportInput(saved.definition);
               await sendExport(response, tenantId, normalized, saved.name, requestedFormat(request));
          } catch (error) {
               fail(response, error);
          }
     }

     static async exportAdhoc(request: Request, response: Response) {
          try {
               const tenantId = tenantOf(request);
               const format = requestedFormat(request);
               const normalized = normalizeReportInput(request.body?.definition ?? request.body);
               await sendExport(response, tenantId, normalized, `report-${normalized.dataset.id}`, format);
          } catch (error) {
               fail(response, error);
          }
     }
}

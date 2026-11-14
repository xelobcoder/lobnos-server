import { getAuthUser } from '../../middleware/authority';
import { Request, Response } from 'express';
import { QCReadingsRepository } from '../../repositories/QualityControl/QCReadingsRepository';
import { QCSessionsRepository } from '../../repositories/QualityControl/QCSessionsRepository';
import KnexConnection from '../../database/KnexConnections';
import { QcEvaluation, evaluateNewValue, thresholdsFor } from '../../models/QualityControl/QCStatistics';

async function loadControlParameter(db: any, session: any, parameterId: string) {
     if (!session) return null;
     return db('control_parameters').where({ id: parameterId, controlMaterialId: session.controlMaterialId }).first();
}

async function priorValuesFor(db: any, sessionId: string, parameterId: string, excludeId?: string): Promise<number[]> {
     let query = db('qc_readings').where({ sessionId, parameterId }).orderBy('createdAt', 'asc');
     if (excludeId) query = query.whereNot({ id: excludeId });
     const rows = await query.select('value');
     return rows.map((row: any) => Number(row.value)).filter((value: number) => Number.isFinite(value));
}

function evaluateAgainst(cp: any, priorValues: number[], value: number): QcEvaluation {
     const target = Number(cp?.value);
     const sd = Number(cp?.standardDeviation);
     return evaluateNewValue(priorValues, value, target, sd, thresholdsFor(target, sd, cp?.warningLimit, cp?.actionLimit));
}

function evaluationColumns(evaluation: QcEvaluation, employeeid: number) {
     return {
          status: evaluation.status,
          z_score: evaluation.zScore,
          rule_violations: JSON.stringify(evaluation.violations),
          evaluated_at: new Date(),
          evaluated_by: employeeid,
     };
}

export class QCReadingsController {
    private getTenantId(req: Request): number {
        const tenantId = parseInt(req.query.tenantId as string);
        if (!tenantId) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }

    async createSession(req: Request, res: Response) {
        try {
            const actor = getAuthUser(req);
            if (!actor) return res.status(401).json({ error: 'Authentication required' });
            if (typeof req.body?.controlMaterialId !== 'string' || !req.body.controlMaterialId.trim() || req.body.controlMaterialId.length > 36) return res.status(400).json({ error: 'Select a control material' });
            const tenantId = actor.tenantId;
            const repository = new QCSessionsRepository(tenantId);
            if (!actor?.branch) return res.status(403).json({ error: 'A branch must be assigned to the QC operator' });
            const db = await import('../../database/KnexConnections').then(module => module.default(tenantId));
            const material = await db('control_materials').where({ id: req.body.controlMaterialId, status: 'active' }).first();
            if (!material) return res.status(400).json({ error: 'Select an active control material' });
            const sessionData = { controlMaterialId: material.id, comments: req.body.comments || null,
                createdby: actor.employeeid, updatedby: actor.employeeid, branchid: actor.branch, device_id: material.deviceId || null };

            const id = await repository.createWithId(sessionData);
            res.status(201).json({ status: true, id, controlMaterialId: material.id });
        } catch (error) {
            console.error('Failed to create QC session:', error);
            res.status(500).json({ error: 'Failed to create QC session' });
        }
    }

    async acceptForResultEntry(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const employeeId = getAuthUser(req)?.employeeid;
            if (!employeeId) return res.status(400).json({ error: 'employeeid is required' });
            const repository = new QCSessionsRepository(tenantId);
            const testId = await repository.recordResultEntryReview(String(req.params.id), employeeId, 'accepted');
            res.json({ status: true, decision: 'accepted', testId });
        } catch (error: any) {
            res.status(400).json({ error: error.message || 'Failed to accept QC session' });
        }
    }

    async revokeForResultEntry(req: Request, res: Response) {
        try {
            const actor = getAuthUser(req);
            if (!actor) return res.status(401).json({ error: 'Authentication required' });
            await new QCSessionsRepository(actor.tenantId).recordResultEntryReview(String(req.params.id), actor.employeeid, 'rejected', req.body?.reason);
            res.json({ status: true, decision: 'rejected' });
        } catch (error: any) { res.status(400).json({ error: error.message }); }
    }
    async bypassForResultEntry(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const employeeId = getAuthUser(req)?.employeeid;
            if (!employeeId) return res.status(400).json({ error: 'employeeid is required' });
            const repository = new QCSessionsRepository(tenantId);
            const testId = await repository.recordResultEntryReview(String(req.params.id), employeeId, 'bypassed', req.body?.reason);
            res.json({ status: true, decision: 'bypassed', testId });
        } catch (error: any) {
            res.status(400).json({ error: error.message || 'Failed to record QC bypass' });
        }
    }

    async getSessionById(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository(tenantId);
            const id = req.params.id as string;

            const session = await repository.findById(id);
            if (!session) {
                return res.status(404).json({ error: 'QC session not found' });
            }
            res.json(session);
        } catch (error) {
            console.error('Failed to fetch QC session:', error);
            res.status(500).json({ error: 'Failed to fetch QC session' });
        }
    }

    async updateSession(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository(tenantId);
            const id = req.params.id as string;
            const actor = getAuthUser(req);
            const session = await repository.findById(id);
            if (!actor || !session || Number(session.branchid) !== Number(actor.branch)) return res.status(403).json({ error: 'QC session access denied' });
            const updates = { comments: req.body.comments || null, updatedby: actor.employeeid };

            const result = await repository.update(id, updates);
            res.json({ status: result });
        } catch (error) {
            console.error('Failed to update QC session:', error);
            res.status(500).json({ error: 'Failed to update QC session' });
        }
    }

    async deleteSession(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const sessionRepo = new QCSessionsRepository(tenantId);
            const readingRepo = new QCReadingsRepository(tenantId);
            const id = req.params.id as string;

            // Delete all readings first
            const readings = await readingRepo.findBySessionId(id);
            await Promise.all(readings.map(reading =>
                readingRepo.delete(reading.id as string)
            ));

            // Then delete the session
            const result = await sessionRepo.delete(id);
            res.json({ status: result });
        } catch (error) {
            console.error('Failed to delete QC session:', error);
            res.status(500).json({ error: 'Failed to delete QC session' });
        }
    }

    async getSessionsPaginated(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository(tenantId);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await repository.findAllPaginated(page, limit);
            res.json(result);
        } catch (error) {
            console.error('Failed to fetch QC sessions:', error);
            res.status(500).json({ error: 'Failed to fetch QC sessions' });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const actor = getAuthUser(req);
            if (!actor) return res.status(401).json({ error: 'Authentication required' });
            const payload = req.body || {};
            const sessionId = String(payload.sessionId || '').trim();
            const parameterId = String(payload.parameterId || '').trim();
            if (!sessionId || sessionId.length > 36) return res.status(400).json({ error: 'A valid QC session is required' });
            if (!parameterId || parameterId.length > 36) return res.status(400).json({ error: 'A valid control parameter is required' });
            const rawValue = typeof payload.value === 'string' ? payload.value.trim() : payload.value;
            const value = Number(rawValue);
            if (rawValue === '' || rawValue === null || rawValue === undefined || !Number.isFinite(value)) {
                return res.status(400).json({ error: 'Enter a numeric QC reading' });
            }

            const db = await KnexConnection(actor.tenantId);
            const session = await db('qc_sessions').where({ id: sessionId }).first();
            if (!session) return res.status(400).json({ error: 'QC session not found' });
            const controlParameter = await loadControlParameter(db, session, parameterId);
            if (!controlParameter) return res.status(400).json({ error: 'This parameter does not belong to the session control material' });

            // The browser does not decide QC status. Prior values plus this value are evaluated here.
            const prior = await priorValuesFor(db, sessionId, parameterId);
            const evaluation = evaluateAgainst(controlParameter, prior, value);
            const repository = new QCReadingsRepository(actor.tenantId);
            await repository.create({
                sessionId,
                parameterId,
                parameter: controlParameter.parameter,
                value: String(value),
                createdby: actor.employeeid,
                ...evaluationColumns(evaluation, actor.employeeid),
            } as any);
            res.status(201).json({ status: true, evaluation });
        } catch (error) {
            console.error('Failed to create QC reading:', error);
            res.status(500).json({ error: 'Failed to create QC reading' });
        }
    }

    async deleteBySessionId(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const sessionId = req.params.sessionId as string;

            const readings = await repository.findBySessionId(sessionId);
            const deletePromises = readings.map(reading =>
                repository.delete(reading.id as string)
            );

            await Promise.all(deletePromises);
            res.status(200).json({ status: true });
        } catch (error) {
            console.error('Failed to delete QC readings:', error);
            res.status(500).json({ error: 'Failed to delete QC readings' });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const actor = getAuthUser(req);
            if (!actor) return res.status(401).json({ error: 'Authentication required' });
            const repository = new QCReadingsRepository(actor.tenantId);
            const id = req.params.id as string;
            const existing = await repository.findById(id);
            if (!existing) return res.status(404).json({ error: 'QC reading not found' });

            const rawValue = typeof req.body?.value === 'string' ? req.body.value.trim() : req.body?.value;
            const value = Number(rawValue);
            if (rawValue === '' || rawValue === null || rawValue === undefined || !Number.isFinite(value)) {
                return res.status(400).json({ error: 'Enter a numeric QC reading' });
            }

            const db = await KnexConnection(actor.tenantId);
            const session = await db('qc_sessions').where({ id: existing.sessionId }).first();
            const controlParameter = await loadControlParameter(db, session, String(existing.parameterId));
            if (!controlParameter) return res.status(400).json({ error: 'The control parameter is no longer available' });

            const prior = await priorValuesFor(db, String(existing.sessionId), String(existing.parameterId), id);
            const evaluation = evaluateAgainst(controlParameter, prior, value);
            // Never accept status, z-score or rule fields from the client.
            const result = await repository.update(id, {
                value: String(value),
                ...evaluationColumns(evaluation, actor.employeeid),
            } as any);
            res.json({ status: result, evaluation });
        } catch (error) {
            console.error('Failed to update QC reading:', error);
            res.status(500).json({ error: 'Failed to update QC reading' });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const id = req.params.id as string;

            const reading = await repository.findById(id);
            if (!reading) {
                return res.status(404).json({ error: 'QC reading not found' });
            }
            res.json(reading);
        } catch (error) {
            console.error('Failed to fetch QC reading:', error);
            res.status(500).json({ error: 'Failed to fetch QC reading' });
        }
    }

    async getBySessionId(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const sessionId = req.params.sessionId as string;

            const readings = await repository.findBySessionId(sessionId);
            res.json(readings);
        } catch (error) {
            console.error('Failed to fetch QC readings:', error);
            res.status(500).json({ error: 'Failed to fetch QC readings' });
        }
    }

    async getBatchesBySessionId(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const sessionId = req.params.sessionId as string;

            if (!sessionId) {
                return res.status(400).json({ error: 'Session ID is required' });
            }

            const batches = await repository.findBatchesBySessionId(sessionId);
            res.json(batches);
        } catch (error) {
            console.error('Failed to fetch QC reading batches:', error);
            res.status(500).json({ error: 'Failed to fetch QC reading batches' });
        }
    }

    async getBySessionAndControlId(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const sessionId = req.params.sessionId as string;
            const controlId = req.params.controlId as string;

            console.log({ controlId, sessionId })

            if (!sessionId || !controlId) {
                return res.status(400).json({ error: 'Both sessionId and controlId are required' });
            }

            const readings = await repository.findBySessionAndControlId(sessionId, controlId as string);
            res.json(readings);
        } catch (error) {
            console.error('Failed to fetch QC readings:', error);
            res.status(500).json({ error: 'Failed to fetch QC readings' });
        }
    }

    async getByStatus(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const { status } = req.query;

            if (!status || typeof status !== 'string') {
                return res.status(400).json({ error: 'Status parameter is required' });
            }

            const readings = await repository.findByStatus(status as any);
            res.json(readings);
        } catch (error) {
            console.error('Failed to fetch QC readings:', error);
            res.status(500).json({ error: 'Failed to fetch QC readings' });
        }
    }

    async getPaginated(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await repository.findAllPaginated(page, limit);
            res.json(result);
        } catch (error) {
            console.error('Failed to fetch QC readings:', error);
            res.status(500).json({ error: 'Failed to fetch QC readings' });
        }
    }

    async addReadingsToSession(req: Request, res: Response) {
        const actor = getAuthUser(req);
        if (!actor) return res.status(401).json({ error: 'Authentication required' });
        const readingsRepository = new QCReadingsRepository(actor.tenantId);
        const sessionsRepository = new QCSessionsRepository(actor.tenantId);
        const { sessionId, readings, comments } = req.body || {};

        if (!sessionId || !Array.isArray(readings) || readings.length === 0) {
            return res.status(400).json({ error: 'Invalid payload: sessionId and non-empty readings array are required' });
        }
        if (readings.length > 100) return res.status(400).json({ error: 'Add at most 100 readings per request' });

        const conn = await KnexConnection(actor.tenantId);
        const evaluations: Array<{ parameterId: string; value: number; evaluation: QcEvaluation }> = [];

        try {
            await conn.transaction(async (trx: any) => {
                let session = await trx('qc_sessions').where({ id: sessionId }).first();
                if (!session) {
                    const materialId = readings[0]?.controlMaterialId;
                    if (typeof materialId !== 'string' || !materialId.trim()) {
                        throw Object.assign(new Error('A QC session must reference a control material'), { statusCode: 400 });
                    }
                    await sessionsRepository.create({
                        id: sessionId,
                        comments,
                        createdBy: actor.employeeid,
                        updatedBy: actor.employeeid,
                        controlMaterialId: materialId,
                    } as any, trx);
                    session = await trx('qc_sessions').where({ id: sessionId }).first();
                }

                const parameterCache = new Map<string, any>();
                const priorCache = new Map<string, number[]>();
                const batchValues = new Map<string, number[]>();

                for (const readingData of readings) {
                    const parameterId = String(readingData?.parameterId || '').trim();
                    const rawValue = typeof readingData?.value === 'string' ? readingData.value.trim() : readingData?.value;
                    const value = Number(rawValue);
                    if (!parameterId || parameterId.length > 36) throw Object.assign(new Error('Every reading needs a valid control parameter'), { statusCode: 400 });
                    if (rawValue === '' || rawValue === null || rawValue === undefined || !Number.isFinite(value)) {
                        throw Object.assign(new Error('Every reading needs a numeric value'), { statusCode: 400 });
                    }
                    if (!parameterCache.has(parameterId)) {
                        const controlParameter = await loadControlParameter(trx, session, parameterId);
                        if (!controlParameter) throw Object.assign(new Error('A reading parameter does not belong to the session control material'), { statusCode: 400 });
                        parameterCache.set(parameterId, controlParameter);
                    }
                    const controlParameter = parameterCache.get(parameterId);
                    if (!priorCache.has(parameterId)) priorCache.set(parameterId, await priorValuesFor(trx, String(sessionId), parameterId));
                    const prior = [...(priorCache.get(parameterId) || []), ...(batchValues.get(parameterId) || [])];
                    const evaluation = evaluateAgainst(controlParameter, prior, value);
                    batchValues.set(parameterId, [...(batchValues.get(parameterId) || []), value]);
                    evaluations.push({ parameterId, value, evaluation });

                    await readingsRepository.create({
                        sessionId,
                        parameterId,
                        parameter: controlParameter.parameter,
                        value: String(value),
                        createdby: actor.employeeid,
                        ...evaluationColumns(evaluation, actor.employeeid),
                    } as any, trx);
                }
            });

            res.status(201).json({ status: true, evaluations });
        } catch (error: any) {
            if (error?.statusCode === 400) return res.status(400).json({ error: error.message });
            console.error('Batch creation failed:', error);
            res.status(500).json({ error: 'Failed to add readings to session' });
        }
    }
}

export default QCReadingsController;

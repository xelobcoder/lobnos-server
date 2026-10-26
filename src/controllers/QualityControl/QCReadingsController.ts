import { getAuthUser } from '../../middleware/authority';
import { Request, Response } from 'express';
import { QCReadingsRepository } from '../../repositories/QualityControl/QCReadingsRepository';
import { QCSessionsRepository } from '../../repositories/QualityControl/QCSessionsRepository';

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
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const readingData = req.body;

            const status = await repository.create(readingData);
            res.status(201).json({ status });
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
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository(tenantId);
            const id = req.params.id as string;
            const updates = req.body;

            const result = await repository.update(id, updates);
            res.json({ status: result });
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
        const tenantId = this.getTenantId(req);
        const readingsRepository = new QCReadingsRepository(tenantId);
        const sessionsRepository = new QCSessionsRepository(tenantId);
        const { sessionId, readings, comments } = req.body;

        if (!sessionId || !Array.isArray(readings) || readings.length === 0) {
            return res.status(400).json({ error: 'Invalid payload: sessionId and non-empty readings array are required' });
        }

        const conn = await (readingsRepository as any).connection;
        const results = [];

        try {
            await conn.transaction(async (trx: any) => {
                // Create session if not exists
                let session = await sessionsRepository.findById(sessionId);
                if (!session) {
                    const sessionData = {
                        id: sessionId,
                        comments,
                        createdBy: readings[0]?.createdby,
                        updatedBy: readings[0]?.updatedby,
                        controlMaterialId: readings[0]?.controlMaterialId
                    };
                    await sessionsRepository.create(sessionData as any, trx);
                }

                // Create readings
                for (const readingData of readings) {
                    const readingToCreate = {
                        sessionId,
                        parameter: readingData.parameter,
                        value: readingData.value,
                        parameterId: readingData.parameterId,
                        status: readingData.status,
                        createdby: readingData.createdby,
                        createdAt: new Date(),
                    };

                    const success = await readingsRepository.create(readingToCreate, trx);
                    results.push({ ...readingToCreate, success });
                }
            });

            res.status(201).json({ status: true });
        } catch (error) {
            console.error('Batch creation failed:', error);
            res.status(500).json({ error: 'Failed to add readings to session' });
        }
    }
}

export default QCReadingsController;

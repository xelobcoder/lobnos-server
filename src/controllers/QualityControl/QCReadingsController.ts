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
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository(tenantId);
            const sessionData = req.body;
            
            const status = await repository.create(sessionData);
            res.status(201).json({ status });
        } catch (error) {
            console.error('Failed to create QC session:', error);
            res.status(500).json({ error: 'Failed to create QC session' });
        }
    }

    async getSessionById(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository(tenantId);
            const { id } = req.params;
            
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
            const { id } = req.params;
            const updates = req.body;
            
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
            const { id } = req.params;
            
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
            const { sessionId } = req.params;
            
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
            const { id } = req.params;
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
            const { id } = req.params;
            
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
            const { sessionId } = req.params;
            
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
            const { sessionId } = req.params;
            
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
            const { sessionId } = req.params;
            const { controlId } = req.params;
            
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
                        parameterId:readingData.parameterId,
                        status: readingData.status,
                        createdby: readingData.createdby,
                        createdAt: readingData.updatedby,
                    };

                    const success = await readingsRepository.create(readingToCreate, trx);
                    results.push({ ...readingToCreate, success });
                }
            });

            res.status(201).json({ status:true});
        } catch (error) {
            console.error('Batch creation failed:', error);
            res.status(500).json({ error: 'Failed to add readings to session' });
        }
    }
}

export default QCReadingsController;
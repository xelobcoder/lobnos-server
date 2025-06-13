import { Request, Response } from 'express';
import PatientClinicalHistoryUltrasoundRepository from '../../models/operations/PatientClinicalHistoryUltrasoundRepo';

function getRepository(req: Request): PatientClinicalHistoryUltrasoundRepository {
    const tenantId = Number(req.query.tenantId);
    if (isNaN(tenantId)) {
        throw new Error('Invalid tenantId in query parameters');
    }
    return new PatientClinicalHistoryUltrasoundRepository(tenantId);
}

export async function createHistory(req: Request, res: Response) {
    try {
        const repository = getRepository(req);
        const historyData = req.body;
        const status = await repository.createHistory(historyData);
        res.status(201).json({ status, message: status ? 'History created successfully' : 'Failed to create history' });
    } catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to create clinical history', error });
    }
}

export async function getHistoryById(req: Request, res: Response) {
    try {
        const repository = getRepository(req);
        const { id } = req.params;
        const history = await repository.getHistoryById(Number(id));
        if (!history) {
            return res.status(404).json({ message: 'Clinical history not found' });
        }
        res.json(history);
    } catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to retrieve clinical history', error });
    }
}

export async function getHistoryByAscensionId(req: Request, res: Response) {
    try {
        const repository = getRepository(req);
        const { ascensionid } = req.params;
        const history = await repository.getHistoryByAscensionId(Number(ascensionid));
        if (!history) {
            return res.status(404).json({ message: 'Clinical history not found' });
        }
        res.json(history);
    } catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to retrieve clinical history', error });
    }
}

export async function updateHistory(req: Request, res: Response) {
    try {
        const repository = getRepository(req);
        const { id } = req.params;
        const updateData = req.body;
        const affectedRows = await repository.updateHistory(Number(id), updateData);
        if (affectedRows === 0) {
            return res.status(404).json({ message: 'Clinical history not found or no changes made' });
        }
        res.json({ message: 'Clinical history updated successfully' });
    } catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to update clinical history', error });
    }
}

export async function deleteHistory(req: Request, res: Response) {
    try {
        const repository = getRepository(req);
        const { id } = req.params;
        const affectedRows = await repository.deleteHistory(Number(id));
        if (affectedRows === 0) {
            return res.status(404).json({ message: 'Clinical history not found' });
        }
        res.json({ message: 'Clinical history deleted successfully' });
    } catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to delete clinical history', error });
    }
}

export async function getAllHistories(req: Request, res: Response) {
    try {
        const repository = getRepository(req);
        const histories = await repository.getAllHistories();
        res.json(histories);
    } catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to retrieve clinical histories', error });
    }
}

export async function getHistoriesByAscensionIds(req: Request, res: Response) {
    try {
        const repository = getRepository(req);
        const { ascensionIds } = req.body;
        if (!Array.isArray(ascensionIds)) {
            return res.status(400).json({ message: 'ascensionIds must be an array' });
        }
        const histories = await repository.getHistoriesByAscensionIds(ascensionIds);
        res.json(histories);
    } catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to retrieve clinical histories', error });
    }
}

export async function upsertHistory(req: Request, res: Response) {
    try {
        const repository = getRepository(req);
        const { ascensionid, clinical_history } = req.body;
        if (!ascensionid || clinical_history === undefined) {
            return res.status(400).json({ message: 'ascensionid and clinical_history are required' });
        }
        const result = await repository.upsertHistory(Number(ascensionid), clinical_history);
        res.json({ id: result, message: 'Clinical history upserted successfully' });
    } catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to upsert clinical history', error });
    }
}

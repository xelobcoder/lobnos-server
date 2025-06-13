import { Request, Response } from 'express';
import FieldConstraintsRepository from '../../models/TestCreation/FieldConstraintsRepository';
import { customError, responseError } from '../../hooks/helper';


interface IRequest extends Request {
    tenantId?: number;
}

export const createFieldConstraintsHandler = async (req: IRequest, res: Response) => {
    try {
        const { constraints } = req.body;
        const tenantId =parseInt( req.query.tenantId as string, 10);

        if (!tenantId || !constraints) {
            return customError('Missing required parameters', 400, res);
        }

        const repository = new FieldConstraintsRepository(tenantId);
        const result = await repository.create(constraints);
        res.status(201).json({ status: true, data: result });
    } catch (error) {
        return responseError(res);
    }
};

export const getFieldConstraintsByFieldIdHandler = async (req: IRequest, res: Response) => {
    try {
        const { fieldId } = req.params;
        const tenantId = req.query.tenantId;

        if (!tenantId || !fieldId) {
            return customError('Missing required parameters', 400, res);
        }
        const parsedTenantId = parseInt(tenantId as string, 10);

        const repository = new FieldConstraintsRepository(parsedTenantId);
        const constraints = await repository.findByFieldId(parseInt(fieldId));
        return res.json({ status: true, data: constraints });

    } catch (error) {
        return responseError(res);
    }
};

export const getFieldConstraintsByTestIdHandler = async (req: IRequest, res: Response) => {
    try {
        const { testId } = req.params;
        const tenantId = parseInt(req.query.tenantId.toString())

        if (!testId) {
            return customError('Missing required parameters', 400, res);
        }

        const repository = new FieldConstraintsRepository(tenantId);
        const constraints = await repository.findByTestId(Number(testId));

        return res.json({ success: true, data: constraints });
    } catch (error) {
        console.error('Get field constraints by test error:', error);
        return responseError(res);
    }
};

export const updateFieldConstraintHandler = async (req: IRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const tenantId = req.tenantId;

        if (!tenantId || !id || !updates) {
            return customError('Missing required parameters', 400, res);
        }

        const repository = new FieldConstraintsRepository(tenantId);
        const success = await repository.update(Number(id), updates);

        return res.json({ success });
    } catch (error) {
        console.error('Update field constraint error:', error);
        return responseError(res);
    }
};

export const deleteFieldConstraintHandler = async (req: IRequest, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;

        if (!tenantId || !id) {
            return customError('Missing required parameters', 400, res);
        }

        const repository = new FieldConstraintsRepository(tenantId);
        const success = await repository.delete(Number(id));

        return res.json({ success });
    } catch (error) {
        console.error('Delete field constraint error:', error);
        return responseError(res);
    }
};

export const deleteFieldConstraintsByFieldIdHandler = async (req: IRequest, res: Response) => {
    try {
        const { fieldId } = req.params;
        const tenantId = req.tenantId;

        if (!tenantId || !fieldId) {
            return customError('Missing required parameters', 400, res);
        }

        const repository = new FieldConstraintsRepository(tenantId);
        const success = await repository.deleteByFieldId(Number(fieldId));

        return res.json({ success });
    } catch (error) {
        console.error('Delete field constraints by field error:', error);
        return responseError(res);
    }
};
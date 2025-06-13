import { responseError } from "../../hooks/helper";
import { DrugManagementService } from "../../models/drugs/drugsUpload";
import { drugCategoryInformation, DrugInfo } from "../../models/drugs/types";
import { Request, Response } from "express";


export async function insertNewDrug(req: Request, res: Response) {
    try {
        const { drug, addedOn, category, createdBy }: { drug: string; addedOn: string | Date; category: string; createdBy: string } = req.body;

        if (!drug || !category || !createdBy) {
            return res.status(400).json({ error: 'Drug name, category, and creator are required' });
        }

        const tenantId: number = parseInt(req.query.tenantId.toString(), 10);
        const drugService = new DrugManagementService();
        const result = await drugService.addNewDrug(tenantId, { drug, addedOn: addedOn || new Date(), category, createdBy });

        if (typeof result === 'boolean') {
            const message = result ? 'Drug added successfully' : 'Drug not added';
            return res.send({ status: result, message });
        }

        return res.send({ status: false, message: result });
    } catch (err) {
        responseError(res);
    }
}

export async function updateDrug(req: Request, res: Response) {
    try {
        const { id, drug, addedOn, category, createdBy }: { id: number; drug: string; addedOn: string; category: string; createdBy: string } = req.body;

        if (!id || !drug || !category || !createdBy) {
            return res.status(400).json({ error: 'Drug ID, name, category, and creator are required' });
        }

        const tenantId: number = parseInt(req.query.tenantId.toString(), 10);
        const drugService = new DrugManagementService();
        const result = await drugService.updateDrug(tenantId, { id, drug, addedOn, category, createdBy });

        if (typeof result === 'boolean') {
            const message = result ? 'Drug updated successfully' : 'Drug not updated';
            return res.send({ status: result, message });
        }

        return res.status(400).json({ error: result });
    } catch (err) {
        responseError(res);
    }
}

export async function deleteDrug(req: Request, res: Response) {
    try {
        const { id, employeeid } = req.query;
        const parsedID = parseInt(id.toString());
        const parsedEmployeeid = parseInt(employeeid.toString());

        if (!parsedID) {
            return res.status(400).json({ error: 'Drug ID is required' });
        }

        const drugService = new DrugManagementService();
        const tenantId: number = parseInt(req.query.tenantId.toString(), 10);
        const result = await drugService.deleteDrug(tenantId, parsedID, parsedEmployeeid);

        if (typeof result == 'boolean') {
            return res.send({ status: result, message: result ? 'Drug deleted successfully' : 'Drug not deleted' });
        } else {
            res.send({ status: false, message: result })
        }
    } catch (err) {
        responseError(res);
    }
}

export async function getDrugs(req: Request, res: Response) {
    try {
        const drugService = new DrugManagementService();
        const tenantId: number = parseInt(req.query.tenantId.toString(), 10);
        const drugs = await drugService.getDrugs(tenantId);
        res.send(drugs);
    } catch (err) {
        responseError(res);
    }
}

// Drug Category Controllers
export async function insertNewDrugCategory(req: Request, res: Response) {
    try {
        const { categoryName, description, createdBy }: drugCategoryInformation = req.body;
        if (!categoryName || !createdBy) {
            return res.status(400).json({ error: 'Category name and creator are required' });
        }
        const drugCategoryService = new DrugManagementService();
        const tenantId: number = parseInt(req.query.tenantId.toString(), 10);
        const result = await drugCategoryService.addNewDrugCategory(tenantId, { categoryName, description, createdBy });
        if (typeof result === 'boolean') {
            const message = result ? 'Drug Category added successfully' : 'Drug category not added';
            return res.send({ status: result, message });
        }
        return res.status(400).json({ error: result });
    } catch (err) {
        responseError(res);
    }
}

export async function updateDrugCategory(req: Request, res: Response) {
    try {
        const { id, categoryName, description, createdBy }: drugCategoryInformation & { id: number } = req.body;
        if (!id || !categoryName || !description || !createdBy) {
            return res.status(400).json({ error: 'ID, category name, description, and creator are required' });
        }
        const drugCategoryService = new DrugManagementService();
        const tenantId: number = parseInt(req.query.tenantId.toString(), 10);
        const result = await drugCategoryService.updateDrugCategory(tenantId, { id, categoryName, description, createdBy });
        if (typeof result === 'boolean') {
            const message = result ? 'Drug Category updated successfully' : 'Drug category not updated';
            return res.send({ status: result, message });
        }
        return res.status(400).json({ error: result });
    } catch (err) {
        responseError(res);
    }
}

export async function deleteDrugCategory(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const parsedID = parseInt(id.slice(1));

        if (!parsedID) {
            return res.status(400).json({ error: 'Category ID is required' });
        }

        const drugCategoryService = new DrugManagementService();
        const tenantId: number = parseInt(req.query.tenantId.toString(), 10);
        const result = await drugCategoryService.deleteDrugCategory(tenantId, parsedID);
        return res.send({ status: result, message: result ? 'Drug Category deleted successfully' : 'Drug category not deleted' });
    } catch (err) {
        responseError(res);
    }
}

export async function getDrugsCategory(req: Request, res: Response) {
    try {
        const tenantId: number = parseInt(req.query.tenantId.toString(), 10);
        const drugCategoryService = new DrugManagementService();
        const categories = await drugCategoryService.getDrugsCategory(tenantId);
        res.send(categories);
    } catch (err) {
        responseError(res);
    }
}

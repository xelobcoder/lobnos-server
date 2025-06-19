import { Request, Response } from "express";
import { EntityType } from "../../models/clincians/c.dev.type";
import BillingStrategy from "../../models/clincians/clinicianBilling";
import { ReferralCoding, ReferralCodingRepo } from "../../models/referral/repositories/ReferralCodingRepo";

interface BillingStrategyRequestBody {
    allConcessionApplied: boolean;
    concessionValue: number;
    concessionMode: 'absolute' | 'percentage';
    price_type?: 'discount' | 'surcharge';
    valid_from?: string;
    valid_until?: string;
    name: string;
    description?: string;
    applicableEntities?: { entity_type: EntityType; entity_id: number }[];
    applicableTest?: { testid: number; concessionValue: number; discountedValue: number; concessionMode: 'absolute' | 'percentage'; pricingType: 'discount' | 'surcharge'; actualPrice: number; originalPrice: number }[];
}

export async function createBillingStrategy(
    req: Request<{}, {}, BillingStrategyRequestBody, { tenantId: string }>,
    res: Response
) {
    try {
        const {
            allConcessionApplied,
            concessionMode,
            concessionValue,
            price_type,
            name,
            applicableTest
        } = req.body;

        if (
            [true, false].includes(allConcessionApplied) === false ||
            !name ||
            name.length > 100
        ) {
            return res.status(400).json({
                message: 'Please provide all required fields: allConcessionApplied, name (max 100 characters).',
            });
        }

        if (allConcessionApplied && (!concessionMode || !concessionValue || !price_type)) {
            return res.status(400).json({
                message: 'Concession mode, concession value, and price type are required when all concessions are applied.',
            });
        }

        if (allConcessionApplied && (concessionValue <= 0 || !concessionValue)) {
            return res.status(400).json({
                message: 'Concession value must be present and greater than zero.',
            });
        }

        const strategyInstance = new BillingStrategy();
        const tenantId = parseInt(req.query.tenantId.toString());
        const strategyId = await strategyInstance.insertBillingStrategy(tenantId, req.body);

        if (typeof strategyId === 'string') {
            res.status(400).json({ status: false, message: strategyId });
        } else {
            if (applicableTest && applicableTest.length > 0 && !allConcessionApplied) {
                await strategyInstance.addApplicableTests(tenantId, strategyId, applicableTest);
            }
            res.status(201).json({ message: 'Billing strategy successfully created.', strategyId });
        }
    } catch (error: any) {
        res.status(500).json({
            message: 'Error creating billing strategy.',
            error: error.message
        });
    }
}

export async function getBillingStrategy(
    req: Request<{ strategyid: string }, {}, {}, { tenantId: string }>,
    res: Response
) {
    try {
        const strategyId = parseInt(req.params.strategyid, 10);
        const tenantId = parseInt(req.query.tenantId);

        if (isNaN(strategyId) || isNaN(tenantId)) {
            res.status(400).json({ message: 'Invalid strategy ID or tenant ID' });
        } else {
            const strategyInstance = new BillingStrategy();
            const strategy = await strategyInstance.getBillingStrategy(tenantId, strategyId);
            if (!strategy) {
                return res.status(404).json({ message: 'Billing strategy not found.' });
            }
            res.status(200).json(strategy);
        }
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving billing strategy.',
            error: error.message
        });
    }
}

export async function updateBillingStrategy(
    req: Request<{ strategyid: string }, {}, BillingStrategyRequestBody, { tenantId: string }>,
    res: Response
) {
    try {
        const strategyId = parseInt(req.params.strategyid);
        const tenantId = parseInt(req.query.tenantId);

        if (isNaN(strategyId) || isNaN(tenantId)) {
            res.status(400).json({ message: 'Invalid strategy ID or tenant ID' });
        } else {
            const strategyInstance = new BillingStrategy();
            const { allConcessionApplied, ...rest } = req.body;
            const updateData = {
                ...rest,
                allConcessionApplied: allConcessionApplied ? 1 : 0
            };
            const result = await strategyInstance.updateBillingStrategy(tenantId, strategyId, updateData);
            if (!result) {
                return res.status(404).json({ message: 'Billing strategy not found or no changes made.' });
            }
            res.status(200).json({ message: 'Strategy updated successfully', result });
        }
    } catch (error: any) {
        res.status(500).json({
            message: 'Error updating billing strategy.',
            error: error.message
        });
    }
}


export async function getAllBillingStrategies(request: Request<{}, {}, {}, {
    tenantId: number, entitytype?: EntityType, entityid?: number,
}>, response: Response) {
    try {
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        if (isNaN(tenantId)) {
            return response.status(400).json({ message: 'Invalid tenant ID' });
        }

        const { entitytype, entityid } = request.query;

        if (entitytype && !['clinician', 'insurance', 'organization', 'general'].includes(entitytype)) {
            return response.status(400).json({ message: 'Invalid entity type. Must be clinician, insurance, organization, or general.' });
        }


        if (entityid && isNaN(parseInt(entityid.toString(), 10))) {
            return response.status(400).json({ message: 'Invalid entity ID' });
        }

        if (entitytype && !entityid) {
            return response.status(400).json({ message: 'Entity ID is required when entity type is provided.' });
        }

        let entityInformation = null;
        if (entitytype && entityid) {
            const strategyInstance = await new BillingStrategy().entityExists(tenantId, entitytype, entityid);
            entityInformation = strategyInstance ? await new BillingStrategy().getEntityInfo(tenantId, entitytype, entityid) : null;
        }

        const strategyInstance = new BillingStrategy();
        const strategies = await strategyInstance.getAllBillingStrategies(tenantId);

        if (!strategies || strategies.length === 0) {
            return response.status(404).json({ message: 'No billing strategies found.' });
        }

        response.status(200).json({
            strategies,
            entityInformation: entityInformation || null
        });
    } catch (error: any) {
        response.status(500).json({
            message: 'Error retrieving billing strategies.',
            error: error.message
        });
    }
}

export async function deleteBillingStrategy(
    req: Request<{ strategyid: string }, {}, {}, { tenantId: string }>,
    res: Response
) {
    try {
        const strategyId = parseInt(req.params.strategyid);
        const tenantId = parseInt(req.query.tenantId);

        if (isNaN(strategyId) || isNaN(tenantId)) {
            res.status(400).json({ message: 'Invalid strategy ID or tenant ID' });
        } else {
            const strategyInstance = new BillingStrategy();
            const result = await strategyInstance.deleteBillingStrategy(tenantId, strategyId);
            if (!result) {
                return res.status(404).json({ message: 'Billing strategy not found.' });
            }
            res.status(200).json({ message: 'Strategy deleted successfully' });
        }
    } catch (error: any) {
        res.status(500).json({
            message: 'Error deleting billing strategy.',
            error: error.message
        });
    }
}

export async function checkEntityHasStrategy(
    req: Request<{ entityid: string, entityType: EntityType }, {}, {}, { tenantId: string; }>,
    res: Response
) {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const entityId = parseInt(req.params.entityid);
        const entityType = req.params.entityType as EntityType;

        if (
            isNaN(tenantId) ||
            isNaN(entityId) ||
            !entityType ||
            !['clinician', 'insurance', 'organization', 'general'].includes(entityType)
        ) {
            return res.status(400).json({ message: 'Invalid tenantId, entityId, or entityType (must be clinician, insurance, organization, general).' });
        }

        const strategyInstance = new BillingStrategy();
        const hasStrategy = await strategyInstance.entityHasStrategy(tenantId, entityType, entityId);
        //get entity information
        if (hasStrategy === null) {
            return res.status(404).json({ message: 'Billing strategy not found for the specified entity.' });
        }

        const strategyIn = await strategyInstance.getBillingStrategyByEntity(tenantId, entityType, entityId);
        const strategyId = Array.isArray(strategyIn) && strategyIn.length > 0 ? strategyIn[0].strategyid : null;
        res.status(200).json({ hasStrategy, strategyId });
    } catch (error: any) {
        console.log(error)
        res.status(500).json({
            message: 'An error occurred while checking the billing strategy.',
            error: error.message,
        });
    }
}

export async function getEntityBillingStrategy(
    req: Request<{ entityid: string }, {}, {}, { tenantId: string; entityType: EntityType }>,
    res: Response
) {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const entityId = parseInt(req.params.entityid, 10);
        const entityType = req.query.entityType;

        if (
            isNaN(tenantId) ||
            isNaN(entityId) ||
            !entityType ||
            !['clinician', 'insurance', 'organization', 'general'].includes(entityType)
        ) {
            return res.status(400).json({ message: 'Invalid tenantId, entityId, or entityType (must be clinician, insurance, organization, general).' });
        }

        const strategyInstance = new BillingStrategy();
        const strategies = await strategyInstance.getBillingStrategyByEntity(tenantId, entityType, entityId);

        if (!strategies || strategies.length === 0) {
            return res.status(404).json({ message: 'Billing strategy not found.' });
        }

        res.status(200).json(strategies);
    } catch (error: any) {
        res.status(500).json({
            message: 'An error occurred while retrieving the billing strategy.',
            error: error.message,
        });
    }
}

export async function getProvidentialBillingHandler(
    req: Request<{ associatedid: string; entityType: EntityType }, {}, {}, { tenantId: string, fallbacktodefault?: string }>,
    res: Response
) {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const fallbackToDefault = req.query.fallbacktodefault && ['true', 'false'].includes(req.query.fallbacktodefault) ?
            req.query.fallbacktodefault == 'true' : false;
        const associatedId = parseInt(req.params.associatedid);
        const { entityType } = req.params;

        if (
            isNaN(tenantId) ||
            isNaN(associatedId) ||
            !entityType ||
            !['clinician', 'insurance', 'organization', 'general'].includes(entityType)
        ) {
            return res.status(400).json({ message: 'Invalid tenantId, associatedId, or entityType (must be clinician, insurance, organization, general).' });
        }

        const strategyInstance = new BillingStrategy();
        const billingData = await strategyInstance.getProvidentialBillingHandler(tenantId, entityType, associatedId, fallbackToDefault);

        if (!billingData || billingData.length === 0) {
            return res.status(404).json({ message: 'Billing data not found.' });
        }

        res.status(200).json(billingData);
    } catch (error: any) {
        res.status(500).json({
            message: 'An error occurred while retrieving the providential billing data.',
            error: error.message,
        });
    }
}

export async function checkStrategyExists(
    req: Request<{ strategyid: string }, {}, {}, { tenantId: string }>,
    res: Response
) {
    try {
        const strategyId = parseInt(req.params.strategyid, 10);
        const tenantId = parseInt(req.query.tenantId);
        if (isNaN(strategyId) || isNaN(tenantId)) {
            return res.status(400).json({ message: 'Invalid strategyId or tenantId.' });
        }
        const strategyInstance = new BillingStrategy();
        const strategy = await strategyInstance.getBillingStrategy(tenantId, strategyId);
        res.status(200).json({ hasStrategy: !!strategy });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error checking strategy existence.',
            error: error.message
        });
    }
}

export async function addCategoryToStrategy(
    req: Request<{ strategyid: string }, {}, { category: EntityType; associatedid: number }, { tenantId: string }>,
    res: Response
) {
    try {
        const strategyId = parseInt(req.params.strategyid);
        const tenantId = parseInt(req.query.tenantId);
        const { category, associatedid } = req.body;
        if (isNaN(strategyId) || isNaN(tenantId) || !category || !associatedid) {
            return res.status(400).json({ message: 'Invalid strategyId, tenantId, category, or associatedid.' });
        }
        const strategyInstance = new BillingStrategy();
        const result = await strategyInstance.addCategoryToStrategy(tenantId, strategyId, category, associatedid);
        res.status(200).json({ message: 'Category added to strategy successfully.', result });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error adding category to strategy.',
            error: error.message
        });
    }
}






export async function removeCategoryFromStrategy(
    req: Request<{ strategyid: string }, {}, { category: EntityType; associatedid: number }, { tenantId: string }>,
    res: Response
) {
    try {
        const strategyId = parseInt(req.params.strategyid);
        const tenantId = parseInt(req.query.tenantId);
        const { category, associatedid } = req.body;
        if (isNaN(strategyId) || isNaN(tenantId) || !category || !associatedid) {
            return res.status(400).json({ message: 'Invalid strategyId, tenantId, category, or associatedid.' });
        }
        const strategyInstance = new BillingStrategy();
        const result = await strategyInstance.deleteStrategyApplicableEntities(tenantId, strategyId, associatedid, category);
        res.status(200).json({ message: 'Category removed from strategy successfully.', result });
    } catch (error: any) {
        console.log(error)
        res.status(500).json({
            message: 'Error removing category from strategy.',
            error: error.message
        });
    }
}



export async function getAllBillingStrategiesMini(
    req: Request<{}, {}, {}, { tenantId: string, page?: string; count?: string }>,
    res: Response
) {
    try {
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        if (isNaN(tenantId)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }

        const strategyInstance = new BillingStrategy();
        const page = parseInt(req.query?.page?.toString() || '1', 10);
        const count = parseInt(req.query?.count?.toString() || '10', 10);
        const strategies = await strategyInstance.getAllBillingStrategiesWithoutApplicableTest(tenantId, count, page);

        if (!strategies || strategies.length === 0) {
            return res.status(404).json({ message: 'No billing strategies found.' });
        }

        res.status(200).json(strategies);
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving billing strategies.',
            error: error.message
        });
    }
}


export async function getEntityInfoUsingSpecialCode(req: Request, res: Response) {
    try {
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const specialCode = req.query.code?.toString();

        if (!specialCode) {
            return res.status(400).json({ message: 'Special code is required.' });
        }
        const getEntityInfo: ReferralCoding | null = await new ReferralCodingRepo(tenantId).findByCode(parseInt(specialCode, 10));
       
        if (!getEntityInfo) {
            return res.status(404).json({ status: 'unfound', message: 'Entity information not found for the provided special code.' });
        }
        const entityType = getEntityInfo.entity_type;
        const entityId = getEntityInfo.entity_id;
        const strategyInstance = new BillingStrategy();
        const entityInformation = await strategyInstance.getEntityInfoWithId(tenantId, entityType, entityId);
        if (!entityInformation) {
            return res.status(404).json({ status: 'unfound', message: 'Entity information not found.' });
        }
        res.send(entityInformation);
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving entity information using special code.',
            error: error.message
        });
    }
}
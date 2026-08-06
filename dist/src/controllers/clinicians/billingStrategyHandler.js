"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBillingStrategy = createBillingStrategy;
exports.getBillingStrategy = getBillingStrategy;
exports.updateBillingStrategy = updateBillingStrategy;
exports.getAllBillingStrategies = getAllBillingStrategies;
exports.deleteBillingStrategy = deleteBillingStrategy;
exports.checkEntityHasStrategy = checkEntityHasStrategy;
exports.getEntityBillingStrategy = getEntityBillingStrategy;
exports.getProvidentialBillingHandler = getProvidentialBillingHandler;
exports.checkStrategyExists = checkStrategyExists;
exports.addCategoryToStrategy = addCategoryToStrategy;
exports.removeCategoryFromStrategy = removeCategoryFromStrategy;
exports.getAllBillingStrategiesMini = getAllBillingStrategiesMini;
exports.getEntityInfoUsingSpecialCode = getEntityInfoUsingSpecialCode;
const billingstrategy_1 = __importDefault(require("../../models/clincians/billingstrategy"));
const ReferralCodingRepo_1 = require("../../models/referral/repositories/ReferralCodingRepo");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
async function createBillingStrategy(req, res) {
    try {
        const { allconcessionApplied, concessionMode, concessionValue, price_type, name, isNHIS, applicableTest } = req.body;
        if ([true, false].includes(allconcessionApplied) === false ||
            !name ||
            name.length > 100) {
            return res.status(400).json({
                message: 'Please provide all required fields: allconcessionApplied, name (max 100 characters).',
            });
        }
        if (allconcessionApplied && (!concessionMode || !concessionValue || !price_type)) {
            return res.status(400).json({
                message: 'Concession mode, concession value, and price type are required when all concessions are applied.',
            });
        }
        if (allconcessionApplied && (concessionValue <= 0 || !concessionValue)) {
            return res.status(400).json({
                message: 'Concession value must be present and greater than zero.',
            });
        }
        const strategyInstance = new billingstrategy_1.default();
        const tenantId = parseInt(req.query.tenantId.toString());
        if (req.body.isNHIS) {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const existingNHIS = await connection('billingstrategy').where({ isNHIS: 1 }).first();
            if (existingNHIS) {
                return res.status(400).json({ message: 'An NHIS billing strategy already exists. Only one NHIS strategy is allowed.' });
            }
        }
        const strategyId = await strategyInstance.insertBillingStrategy(tenantId, req.body);
        if (typeof strategyId === 'string') {
            res.status(400).json({ status: false, message: strategyId });
        }
        else {
            res.status(201).json({ message: 'Billing strategy successfully created.', strategyId });
        }
    }
    catch (error) {
        res.status(500).json({
            message: 'Error creating billing strategy.',
            error: error.message
        });
    }
}
async function getBillingStrategy(req, res) {
    try {
        const strategyId = parseInt(req.params.strategyid, 10);
        const tenantId = parseInt(req.query.tenantId);
        if (isNaN(strategyId) || isNaN(tenantId)) {
            res.status(400).json({ message: 'Invalid strategy ID or tenant ID' });
        }
        else {
            const strategyInstance = new billingstrategy_1.default();
            const strategy = await strategyInstance.getBillingStrategy(tenantId, strategyId);
            if (!strategy) {
                return res.status(404).json({ message: 'Billing strategy not found.' });
            }
            res.status(200).json(strategy);
        }
    }
    catch (error) {
        res.status(500).json({
            message: 'Error retrieving billing strategy.',
            error: error.message
        });
    }
}
async function updateBillingStrategy(req, res) {
    try {
        const strategyId = parseInt(req.params.strategyid);
        const tenantId = parseInt(req.query.tenantId);
        if (isNaN(strategyId) || isNaN(tenantId)) {
            return res.status(400).json({ message: 'Invalid strategy ID or tenant ID' });
        }
        const { allconcessionApplied, concessionMode, concessionValue, price_type, name, applicableTest } = req.body;
        if ([true, false].includes(allconcessionApplied) === false ||
            !name ||
            name.length > 100) {
            return res.status(400).json({
                message: 'Please provide all required fields: allconcessionApplied, name (max 100 characters).',
            });
        }
        if (allconcessionApplied && (!concessionMode || !concessionValue || !price_type)) {
            return res.status(400).json({
                message: 'Concession mode, concession value, and price type are required when all concessions are applied.',
            });
        }
        if (allconcessionApplied && (concessionValue <= 0 || !concessionValue)) {
            return res.status(400).json({
                message: 'Concession value must be present and greater than zero.',
            });
        }
        const strategyInstance = new billingstrategy_1.default();
        const result = await strategyInstance.updateBillingStrategy(tenantId, strategyId, req.body);
        if (result !== 'updated successfully') {
            return res.status(400).json({ status: false, message: result });
        }
        res.status(200).json({ message: 'Billing strategy successfully updated.', strategyId });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error updating billing strategy.',
            error: error.message
        });
    }
}
async function getAllBillingStrategies(request, response) {
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
            const strategyInstance = await new billingstrategy_1.default().entityExists(tenantId, entitytype, entityid);
            entityInformation = strategyInstance ? await new billingstrategy_1.default().getEntityInfo(tenantId, entitytype, entityid) : null;
        }
        const strategyInstance = new billingstrategy_1.default();
        const strategies = await strategyInstance.getAllBillingStrategies(tenantId);
        if (!strategies || strategies.length === 0) {
            return response.status(404).json({ message: 'No billing strategies found.' });
        }
        response.status(200).json({
            strategies,
            entityInformation: entityInformation || null
        });
    }
    catch (error) {
        response.status(500).json({
            message: 'Error retrieving billing strategies.',
            error: error.message
        });
    }
}
async function deleteBillingStrategy(req, res) {
    try {
        const strategyId = parseInt(req.params.strategyid);
        const tenantId = parseInt(req.query.tenantId);
        if (isNaN(strategyId) || isNaN(tenantId)) {
            res.status(400).json({ message: 'Invalid strategy ID or tenant ID' });
        }
        else {
            const strategyInstance = new billingstrategy_1.default();
            const result = await strategyInstance.deleteBillingStrategy(tenantId, strategyId);
            if (!result) {
                return res.status(404).json({ message: 'Billing strategy not found.', status: false });
            }
            return res.status(200).json({ message: 'Strategy deleted successfully', status: true });
        }
    }
    catch (error) {
        return res.status(500).json({
            message: 'Error deleting billing strategy.',
            error: error.message,
            status: false
        });
    }
}
async function checkEntityHasStrategy(req, res) {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const entityId = parseInt(req.params.entityid);
        const entityType = req.params.entityType;
        if (isNaN(tenantId) ||
            isNaN(entityId) ||
            !entityType ||
            !['clinician', 'insurance', 'organization', 'general'].includes(entityType)) {
            return res.status(400).json({ message: 'Invalid tenantId, entityId, or entityType (must be clinician, insurance, organization, general).' });
        }
        const strategyInstance = new billingstrategy_1.default();
        const hasStrategy = await strategyInstance.entityHasStrategy(tenantId, entityType, entityId);
        //get entity information
        if (hasStrategy === null) {
            return res.status(404).json({ message: 'Billing strategy not found for the specified entity.' });
        }
        const strategyIn = await strategyInstance.getBillingStrategyByEntity(tenantId, entityType, entityId);
        const strategyId = Array.isArray(strategyIn) && strategyIn.length > 0 ? strategyIn[0].strategyid : null;
        res.status(200).json({ hasStrategy, strategyId });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'An error occurred while checking the billing strategy.',
            error: error.message,
        });
    }
}
async function getEntityBillingStrategy(req, res) {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const entityId = parseInt(req.params.entityid, 10);
        const entityType = req.query.entityType;
        if (isNaN(tenantId) ||
            isNaN(entityId) ||
            !entityType ||
            !['clinician', 'insurance', 'organization', 'general'].includes(entityType)) {
            return res.status(400).json({ message: 'Invalid tenantId, entityId, or entityType (must be clinician, insurance, organization, general).' });
        }
        const strategyInstance = new billingstrategy_1.default();
        const strategies = await strategyInstance.getBillingStrategyByEntity(tenantId, entityType, entityId);
        if (!strategies || strategies.length === 0) {
            return res.status(404).json({ message: 'Billing strategy not found.' });
        }
        res.status(200).json(strategies);
    }
    catch (error) {
        res.status(500).json({
            message: 'An error occurred while retrieving the billing strategy.',
            error: error.message,
        });
    }
}
async function getProvidentialBillingHandler(req, res) {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const fallbackToDefault = req.query.fallbacktodefault && ['true', 'false'].includes(req.query.fallbacktodefault) ?
            req.query.fallbacktodefault == 'true' : false;
        const associatedId = parseInt(req.params.associatedid);
        const { entityType } = req.params;
        if (isNaN(tenantId) ||
            isNaN(associatedId) ||
            !entityType ||
            !['clinician', 'insurance', 'organization', 'general'].includes(entityType)) {
            return res.status(400).json({ message: 'Invalid tenantId, associatedId, or entityType (must be clinician, insurance, organization, general).' });
        }
        const strategyInstance = new billingstrategy_1.default();
        const billingData = await strategyInstance.getProvidentialBillingHandler(tenantId, entityType, associatedId, fallbackToDefault);
        if (!billingData || billingData.length === 0) {
            return res.status(404).json({ message: 'Billing data not found.' });
        }
        res.status(200).json(billingData);
    }
    catch (error) {
        res.status(500).json({
            message: 'An error occurred while retrieving the providential billing data.',
            error: error.message,
        });
    }
}
async function checkStrategyExists(req, res) {
    try {
        const strategyId = parseInt(req.params.strategyid, 10);
        const tenantId = parseInt(req.query.tenantId);
        if (isNaN(strategyId) || isNaN(tenantId)) {
            return res.status(400).json({ message: 'Invalid strategyId or tenantId.' });
        }
        const strategyInstance = new billingstrategy_1.default();
        const strategy = await strategyInstance.getBillingStrategy(tenantId, strategyId);
        res.status(200).json({ hasStrategy: !!strategy });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error checking strategy existence.',
            error: error.message
        });
    }
}
async function addCategoryToStrategy(req, res) {
    try {
        const strategyId = parseInt(req.params.strategyid);
        const tenantId = parseInt(req.query.tenantId);
        const { category, associatedid } = req.body;
        if (isNaN(strategyId) || isNaN(tenantId) || !category || !associatedid) {
            return res.status(400).json({ message: 'Invalid strategyId, tenantId, category, or associatedid.' });
        }
        const strategyInstance = new billingstrategy_1.default();
        const result = await strategyInstance.addCategoryToStrategy(tenantId, strategyId, category, associatedid);
        res.status(200).json({ message: 'Category added to strategy successfully.', result });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error adding category to strategy.',
            error: error.message
        });
    }
}
async function removeCategoryFromStrategy(req, res) {
    try {
        const strategyId = parseInt(req.params.strategyid);
        const tenantId = parseInt(req.query.tenantId);
        const { category, associatedid } = req.body;
        if (isNaN(strategyId) || isNaN(tenantId) || !category || !associatedid) {
            return res.status(400).json({ message: 'Invalid strategyId, tenantId, category, or associatedid.' });
        }
        const strategyInstance = new billingstrategy_1.default();
        const result = await strategyInstance.deleteStrategyApplicableEntities(tenantId, strategyId, associatedid, category);
        res.status(200).json({ message: 'Category removed from strategy successfully.', result });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Error removing category from strategy.',
            error: error.message
        });
    }
}
async function getAllBillingStrategiesMini(req, res) {
    var _a, _b, _c, _d, _e, _f;
    try {
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        if (isNaN(tenantId)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }
        const strategyInstance = new billingstrategy_1.default();
        const page = parseInt(((_b = (_a = req.query) === null || _a === void 0 ? void 0 : _a.page) === null || _b === void 0 ? void 0 : _b.toString()) || '1', 10);
        const count = parseInt(((_d = (_c = req.query) === null || _c === void 0 ? void 0 : _c.count) === null || _d === void 0 ? void 0 : _d.toString()) || '10', 10);
        const sortbyRaw = (_f = (_e = req.query) === null || _e === void 0 ? void 0 : _e.sortby) === null || _f === void 0 ? void 0 : _f.toString();
        const strategies = await strategyInstance.getAllBillingStrategiesWithoutApplicableTest(tenantId, count, page, sortbyRaw);
        if (!strategies || strategies.length === 0) {
            return res.status(404).json({ message: 'No billing strategies found.' });
        }
        res.status(200).json(strategies);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error retrieving billing strategies.',
            error: error.message
        });
    }
}
async function getEntityInfoUsingSpecialCode(req, res) {
    var _a;
    try {
        const tenantId = parseInt(req.query.tenantId.toString(), 10);
        const specialCode = (_a = req.query.code) === null || _a === void 0 ? void 0 : _a.toString();
        if (!specialCode) {
            return res.status(400).json({ message: 'Special code is required.' });
        }
        const getEntityInfo = await new ReferralCodingRepo_1.ReferralCodingRepo(tenantId).findByCode(specialCode);
        if (!getEntityInfo) {
            return res.status(404).json({ status: 'unfound', message: 'Entity information not found for the provided special code.' });
        }
        const entityType = getEntityInfo.entity_type;
        const entityId = getEntityInfo.entity_id;
        const strategyInstance = new billingstrategy_1.default();
        const entityInformation = await strategyInstance.getEntityInfoWithId(tenantId, entityType, entityId);
        if (!entityInformation) {
            return res.status(404).json({ status: 'unfound', message: 'Entity information not found.' });
        }
        res.send(entityInformation);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error retrieving entity information using special code.',
            error: error.message
        });
    }
}

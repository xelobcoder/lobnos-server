"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestDefinitionsTestId = exports.deleteTestCondition = exports.updateTestCondition = exports.getTestCondition = exports.getTestDefinitionConditionsHandler = exports.createTestCondition = exports.deleteTestConditionDefinition = exports.updateTestConditionDefinition = exports.getTestConditionDefinition = exports.createTestConditionDefinition = void 0;
const testCreationMultipleCondtionsClass_1 = __importDefault(require("../../models/operations/testCreationMultipleCondtionsClass"));
const helper_1 = require("../../hooks/helper");
const createTestConditionDefinition = async (req, res) => {
    try {
        const { conditionName, testid } = req.body;
        const tenantId = req.query.tenantId;
        const instance = new testCreationMultipleCondtionsClass_1.default();
        const result = await instance.createTestConditionDefinition(Number(tenantId), conditionName, testid);
        const status = (0, helper_1.rowAffected)(result);
        res.status(201).json({ status, conditionId: result === null || result === void 0 ? void 0 : result.insertId });
    }
    catch (error) {
        (0, helper_1.responseError)(res);
    }
};
exports.createTestConditionDefinition = createTestConditionDefinition;
const getTestConditionDefinition = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.query.tenantId;
        const instance = new testCreationMultipleCondtionsClass_1.default();
        const rows = await instance.getTestConditionDefinitionById(Number(tenantId), Number(id));
        res.status(200).json(rows);
    }
    catch (error) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTestConditionDefinition = getTestConditionDefinition;
const updateTestConditionDefinition = async (req, res) => {
    try {
        const { id } = req.params;
        const { conditionName, testid } = req.body;
        const tenantId = req.query.tenantId;
        const instance = new testCreationMultipleCondtionsClass_1.default();
        const result = await instance.updateTestConditionDefinition(Number(tenantId), Number(id), conditionName, testid);
        res.status(200).json({ status: result });
    }
    catch (error) {
        (0, helper_1.responseError)(res);
    }
};
exports.updateTestConditionDefinition = updateTestConditionDefinition;
const deleteTestConditionDefinition = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.query.tenantId;
        const instance = new testCreationMultipleCondtionsClass_1.default();
        const result = await instance.deleteTestConditionDefinition(Number(tenantId), Number(id));
        res.status(200).json({ status: result });
    }
    catch (error) {
        (0, helper_1.responseError)(res);
    }
};
exports.deleteTestConditionDefinition = deleteTestConditionDefinition;
const createTestCondition = async (req, res) => {
    try {
        const { testid, conditionId, createdBy, fieldConstraints = [] } = req.body;
        const tenantId = req.query.tenantId;
        const instance = new testCreationMultipleCondtionsClass_1.default();
        const status = await instance.createTestCondition(Number(tenantId), testid, conditionId, fieldConstraints, createdBy);
        res.status(201).json({ status });
    }
    catch (error) {
        console.log(error);
        (0, helper_1.responseError)(res);
    }
};
exports.createTestCondition = createTestCondition;
const getTestDefinitionConditionsHandler = async (req, res) => {
    try {
        const { conditionId } = req.params;
        const tenantId = req.query.tenantId;
        if (!isNaN(parseInt(conditionId.toString()))) {
            const result = await new testCreationMultipleCondtionsClass_1.default().getTestDefinitionConditions(Number(tenantId), parseInt(conditionId.toString()));
            res.status(201).json({ result });
        }
    }
    catch (error) {
        console.log(error);
        (0, helper_1.responseError)(res);
    }
};
exports.getTestDefinitionConditionsHandler = getTestDefinitionConditionsHandler;
const getTestCondition = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.query.tenantId;
        const instance = new testCreationMultipleCondtionsClass_1.default();
        const rows = await instance.getTestConditionById(Number(tenantId), Number(id));
        res.status(200).json(rows);
    }
    catch (error) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTestCondition = getTestCondition;
const updateTestCondition = async (req, res) => {
    try {
        const { id } = req.params;
        const { testId, parameter, conditionId, target, inRange, createdBy } = req.body;
        const tenantId = req.query.tenantId;
        const instance = new testCreationMultipleCondtionsClass_1.default();
        const result = await instance.updateTestCondition(Number(tenantId), Number(id), testId, parameter, conditionId, target, inRange, createdBy);
        res.status(200).json(result);
    }
    catch (error) {
        (0, helper_1.responseError)(res);
    }
};
exports.updateTestCondition = updateTestCondition;
const deleteTestCondition = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.query.tenantId;
        const instance = new testCreationMultipleCondtionsClass_1.default();
        const result = await instance.deleteTestCondition(Number(tenantId), Number(id));
        res.status(200).json(result);
    }
    catch (error) {
        (0, helper_1.responseError)(res);
    }
};
exports.deleteTestCondition = deleteTestCondition;
const getTestDefinitionsTestId = async (req, res) => {
    try {
        const { testid } = req.params;
        const tenantId = req.query.tenantId;
        const result = await testCreationMultipleCondtionsClass_1.default.getTestDefinitions(Number(tenantId), parseInt(testid.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTestDefinitionsTestId = getTestDefinitionsTestId;

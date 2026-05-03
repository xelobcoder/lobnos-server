"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class TestCreationRulesRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    toNullableNumber(value) {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        const parsedValue = Number(value);
        return Number.isFinite(parsedValue) ? parsedValue : null;
    }
    toTinyInt(value, fallback = 0) {
        if (value === undefined || value === null || value === '') {
            return fallback;
        }
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        const parsedValue = Number(value);
        if (!Number.isFinite(parsedValue)) {
            return fallback;
        }
        return parsedValue > 0 ? 1 : 0;
    }
    async create(rulesData, testid) {
        var _a, _b;
        try {
            const conn = await this.connection;
            const existingRules = await conn('testcreationrules')
                .where('testid', testid)
                .select('id', 'name');
            const newRuleNames = rulesData.map(rule => rule.name);
            const rulesToDelete = existingRules.filter(rule => !newRuleNames.includes(rule.name));
            if (rulesToDelete.length > 0) {
                await conn('testcreationrules')
                    .whereIn('id', rulesToDelete.map(rule => rule.id))
                    .delete();
            }
            const insertedIds = [];
            for (const ruleData of rulesData) {
                const existingRule = await conn('testcreationrules')
                    .where({ testid, name: ruleData.name })
                    .first();
                const updateData = {
                    field: ruleData.field,
                    value: ruleData.value,
                    hasunits: this.toTinyInt(ruleData.hasunits),
                    units: ruleData.units,
                    plan: ruleData.plan,
                    plain: ruleData.plain,
                    ordering: this.toNullableNumber(ruleData.ordering),
                    isValueTracked: this.toTinyInt(ruleData.isValueTracked),
                    textReference: ruleData.textReference,
                    upperlimit: (_a = ruleData.upperlimit) !== null && _a !== void 0 ? _a : ruleData.upperLimit,
                    lowerlimit: (_b = ruleData.lowerlimit) !== null && _b !== void 0 ? _b : ruleData.lowerLimit,
                    category: ruleData.category,
                    options: ruleData.options,
                    undercategory: this.toTinyInt(ruleData.undercategory),
                    categoryid: this.toNullableNumber(ruleData.categoryid),
                    valueAlert: ruleData.valueAlert,
                    alert: ruleData.alert,
                    upperLimitFemale: ruleData.upperLimitFemale,
                    lowerLimitFemale: ruleData.lowerLimitFemale,
                    upperLimitMale: ruleData.upperLimitMale,
                    lowerLimitMale: ruleData.lowerLimitMale,
                    upperLimitChildren: ruleData.upperLimitChildren,
                    lowerLimitChildren: ruleData.lowerLimitChildren,
                    upperLimitNeonates: ruleData.upperLimitNeonates,
                    lowerLimitNeonates: ruleData.lowerLimitNeonates
                };
                if (existingRule) {
                    await conn('testcreationrules')
                        .where({ testid, name: ruleData.name })
                        .update(updateData);
                    insertedIds.push(existingRule.id);
                }
                else {
                    const insertData = Object.assign({ testid, name: ruleData.name }, updateData);
                    const result = await conn('testcreationrules')
                        .insert(insertData);
                    insertedIds.push(Array.isArray(result) ? result[0] : result);
                }
            }
            return insertedIds;
        }
        catch (error) {
            console.error('Test creation rules bulk creation error:', error);
            throw error;
        }
    }
    async findByTestId(testId) {
        try {
            const conn = await this.connection;
            const result = await conn('testcreationrules')
                .where('testid', testId)
                .orderBy('ordering', 'asc');
            return result;
        }
        catch (error) {
            console.error('Test creation rule find by test error:', error);
            throw error;
        }
    }
    async findByTestIdAndId(testId, ruleId) {
        try {
            const conn = await this.connection;
            const result = await conn('testcreationrules')
                .where({ testid: testId, id: ruleId })
                .first();
            return result;
        }
        catch (error) {
            console.error('Test creation rule find by test and id error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            const result = await conn('testcreationrules')
                .where('id', id)
                .update(updates);
            return result > 0;
        }
        catch (error) {
            console.error('Test creation rule update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            const result = await conn('testcreationrules')
                .where('id', id)
                .delete();
            return result > 0;
        }
        catch (error) {
            console.error('Test creation rule delete error:', error);
            throw error;
        }
    }
    async deleteByTestId(testId) {
        try {
            const conn = await this.connection;
            const result = await conn('testcreationrules')
                .where('testid', testId)
                .delete();
            return result > 0;
        }
        catch (error) {
            console.error('Test creation rule delete by test error:', error);
            throw error;
        }
    }
}
exports.default = TestCreationRulesRepository;

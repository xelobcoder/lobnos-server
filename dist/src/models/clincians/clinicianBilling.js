"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const Insurance_1 = __importDefault(require("../insurance/Insurance"));
const customTestEntry_1 = require("../resultentry/customTestEntry");
const clinicianClass_1 = __importDefault(require("./clinicianClass"));
class BillingStrategy {
    async entityExists(tenantId, entity_type, entity_id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        switch (entity_type) {
            case 'clinician':
                const clinician = await new clinicianClass_1.default().getSingleClinician(tenantId, entity_id);
                return clinician.length > 0;
            case 'insurance':
                return await new Insurance_1.default(entity_id).checkInsuranceExistence(tenantId, entity_id);
            case 'organization':
                const organization = await connection('organization').where({ id: entity_id }).first();
                return !!organization;
            case 'general':
                return true;
            default:
                return false;
        }
    }
    async getEntityInfo(tenantId, entity_type, entity_id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        switch (entity_type) {
            case 'clinician':
                const clinician = await new clinicianClass_1.default().getSingleClinician(tenantId, entity_id);
                return clinician;
            case 'insurance':
                return await new Insurance_1.default(entity_id).getInsuranceById(tenantId, entity_id);
            case 'organization':
                const organization = await connection('organization').where({ id: entity_id }).first();
                return organization;
            case 'general':
                return true;
            default:
                return false;
        }
    }
    calculateDiscountedValue(originalPrice, concessionMode, concessionValue, pricingType) {
        let discountedValue = concessionMode === 'absolute' ? concessionValue : (originalPrice * concessionValue) / 100;
        discountedValue = Math.max(0, discountedValue);
        const finalPrice = pricingType === 'discount' ? originalPrice - discountedValue : originalPrice + discountedValue;
        return Number((finalPrice < 0 ? (pricingType === 'discount' ? originalPrice : 0) : finalPrice).toFixed(2));
    }
    async validateApplicableTest(tenantId, applicableTest, allConcessionApplied) {
        if (!allConcessionApplied && !Array.isArray(applicableTest)) {
            throw new TypeError("Expected 'applicableTest' to be an array.");
        }
        if (!allConcessionApplied && applicableTest.length > 0) {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const validTests = await connection('test_panels').select('id', 'price').whereIn('id', applicableTest.map(item => item.testid));
            const mapped = applicableTest.filter(item => {
                const test = validTests.find((valid) => valid.id === item.testid);
                if (!test ||
                    !item.testid ||
                    typeof item.testid !== 'number' ||
                    item.concessionValue < 0 ||
                    item.concessionValue > 9999.99 ||
                    !['absolute', 'percentage'].includes(item.concessionMode) ||
                    !['discount', 'surcharge'].includes(item.pricingType)) {
                    return false;
                }
                const calculatedFinalPrice = this.calculateDiscountedValue(item.originalPrice, item.concessionMode, item.concessionValue, item.pricingType);
                return (Math.abs(item.discountedValue - calculatedFinalPrice) < 0.01 &&
                    item.discountedValue <= 9999.99 &&
                    item.actualPrice >= 0 &&
                    item.originalPrice >= 0);
            });
            return mapped.length > 0 ? mapped : null;
        }
        return null;
    }
    async validateApplicableEntities(tenantId, applicableEntities) {
        if (!Array.isArray(applicableEntities) || applicableEntities.length === 0) {
            return [{ entity_type: 'general', entity_id: 0 }];
        }
        const validEntities = await Promise.all(applicableEntities.map(async (entity) => {
            const exists = await this.entityExists(tenantId, entity.entity_type, entity.entity_id);
            return exists ? entity : null;
        }));
        const filtered = validEntities.filter((entity) => entity !== null);
        return filtered.length > 0 ? filtered : null;
    }
    async sanitizeClinicianBillingData(tenantId, data) {
        const { allConcessionApplied, concessionValue, concessionMode, price_type = 'discount', valid_from, valid_until, name, description, applicableTest } = data;
        if (!name || name.length > 100) {
            return 'Strategy name is required and must not exceed 100 characters.';
        }
        if (concessionValue < 0 || concessionValue > 9999.99) {
            return 'Concession value must be between 0 and 9999.99.';
        }
        // const validatedApplicableEntities = await this.validateApplicableEntities(tenantId, applicableEntities || []);
        // if (validatedApplicableEntities === null) {
        //      return 'No valid entities provided.';
        // }
        let validatedApplicableTest = null;
        if (!allConcessionApplied && applicableTest && Array.isArray(applicableTest) && applicableTest.length > 0) {
            validatedApplicableTest = await this.validateApplicableTest(tenantId, applicableTest, allConcessionApplied);
            if (validatedApplicableTest === null) {
                return 'No valid tests provided.';
            }
        }
        return {
            allConcessionApplied: allConcessionApplied ? 1 : 0,
            concessionValue,
            concessionMode,
            price_type,
            name,
            description: description || null,
            valid_from: valid_from || null,
            valid_until: valid_until || null,
            is_expired: valid_until ? new Date(valid_until) < new Date() : false,
            createdon: new Date().toISOString(),
            updatedon: null,
            strategyid: 0,
            applicableTest: validatedApplicableTest || []
        };
    }
    async insertBillingStrategy(tenantId, requestBody) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            const strategyId = await connection.transaction(async (trx) => {
                var _a;
                const data = await this.sanitizeClinicianBillingData(tenantId, requestBody);
                if (typeof data === 'string')
                    throw new Error(data);
                const insertResult = await trx('billingstrategy')
                    .insert({
                    name: data.name,
                    description: data.description,
                    allConcessionApplied: data.allConcessionApplied,
                    concessionValue: data.concessionValue,
                    concessionMode: data.concessionMode,
                    price_type: data.price_type,
                    valid_from: data.valid_from,
                    valid_until: data.valid_until,
                    is_expired: data.is_expired,
                    createdon: data.createdon,
                    updatedon: data.updatedon
                })
                    .onConflict('name')
                    .merge({
                    description: data.description,
                    allConcessionApplied: data.allConcessionApplied,
                    concessionValue: data.concessionValue,
                    concessionMode: data.concessionMode,
                    price_type: data.price_type,
                    valid_from: data.valid_from,
                    valid_until: data.valid_until,
                    is_expired: data.is_expired,
                    updatedon: trx.fn.now()
                });
                const [insertedStrategyId] = insertResult;
                if (!insertedStrategyId) {
                    throw new Error('Failed to insert or update billing strategy.');
                }
                if (data.allConcessionApplied === 0 && ((_a = data.applicableTest) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    // 1. Prepare data
                    const values = data.applicableTest.map(test => [
                        insertedStrategyId,
                        test.testid,
                        test.concessionValue,
                        test.discountedValue,
                        test.concessionMode,
                        test.pricingType
                    ]);
                    // 2. UPSERT: Insert or update existing
                    await trx.raw(`
                         INSERT INTO billingstrategy_tests 
                         (strategyid, testid, concessionValue, discountedValue, concessionMode, pricingType)
                         VALUES ${values.map(() => '(?, ?, ?, ?, ?, ?)').join(',')}
                         ON DUPLICATE KEY UPDATE
                         concessionValue = VALUES(concessionValue),
                         discountedValue = VALUES(discountedValue),
                         concessionMode = VALUES(concessionMode),
                         pricingType = VALUES(pricingType)
                    `, values.flat());
                    // 3. DELETE: Remove tests no longer in the request
                    const requestTestIds = data.applicableTest.map(test => test.testid);
                    await trx('billingstrategy_tests')
                        .where({ strategyid: insertedStrategyId })
                        .whereNotIn('testid', requestTestIds)
                        .del();
                }
                else {
                    // If allConcessionApplied is 1, clear old tests
                    await trx('billingstrategy_tests')
                        .where({ strategyid: insertedStrategyId })
                        .del();
                }
                return insertedStrategyId;
            });
            return parseInt(strategyId.toString());
        }
        catch (error) {
            throw new Error(`Failed to insert billing strategy: ${error.message}`);
        }
    }
    async addApplicableTests(tenantId, strategyid, applicableTest) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            const strategy = await connection('billingstrategy').where({ strategyid }).first();
            if (!strategy) {
                throw new Error('Billing strategy not found.');
            }
            if (strategy.allConcessionApplied === 1) {
                throw new Error('Cannot add applicable tests to a strategy with allConcessionApplied enabled.');
            }
            const validatedApplicableTest = await this.validateApplicableTest(tenantId, applicableTest, false);
            if (validatedApplicableTest === null) {
                throw new Error("applicableTest Not found or has invalid content" /* OperationsFailures.applicableTestNotFound */ + ' or invalid content of applicable Test');
            }
            await connection.transaction(async (trx) => {
                await trx('billingstrategy_tests').where({ strategyid }).del();
                await trx('billingstrategy_tests').insert(validatedApplicableTest.map(test => ({
                    strategyid,
                    testid: test.testid,
                    concessionValue: test.concessionValue,
                    discountedValue: test.discountedValue,
                    concessionMode: test.concessionMode,
                    pricingType: test.pricingType
                })));
            });
            return true;
        }
        catch (error) {
            console.error(error);
            throw new Error(`Failed to add applicable tests: ${error.message}`);
        }
    }
    async addCategoryToStrategy(tenantId, strategyid, category, associatedid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            const strategy = await connection('billingstrategy').where({ strategyid }).first();
            if (!strategy) {
                throw new Error('Billing strategy not found.');
            }
            const entity_type = category === 'phis' ? 'insurance' : category;
            if (!['clinician', 'insurance', 'organization', 'general'].includes(entity_type)) {
                throw new Error(`Invalid entity type: ${entity_type}`);
            }
            const exists = await this.entityExists(tenantId, entity_type, associatedid);
            if (!exists) {
                throw new Error(`Entity of type ${entity_type} with ID ${associatedid} does not exist.`);
            }
            const existingMapping = await connection('billingstrategy_mapping')
                .where({ strategyid, entity_type, entity_id: associatedid })
                .first();
            //      if (existingMapping) {
            //      throw new Error(`Mapping for strategy ${strategyid} to ${entity_type} ID ${associatedid} already exists.`);
            // }
            await connection('billingstrategy_mapping').insert({
                strategyid,
                entity_type,
                entity_id: associatedid
            }).onConflict(['strategyid', 'entity_type', 'entity_id']).merge({
                entity_type,
                entity_id: associatedid
            });
            return true;
        }
        catch (error) {
            console.error(error);
            throw new Error(`Failed to add category to strategy: ${error.message}`);
        }
    }
    async sanitizeToFieldsOfStrategy(strategyid, tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const strategy = await connection('billingstrategy').where({ strategyid }).first();
        if (!strategy) {
            throw new Error('Billing strategy not found.');
        }
        const applicableTest = await connection('billingstrategy_tests as bst')
            .leftJoin('test_panels as tp', 'bst.testid', 'tp.id')
            .select('bst.testid', 'bst.concessionValue', 'bst.discountedValue', 'bst.concessionMode', 'bst.pricingType', 'tp.price as actualPrice', 'tp.price as originalPrice', 'tp.name')
            .where({ 'bst.strategyid': strategyid });
        let applicableEntities = await connection('billingstrategy_mapping')
            .leftJoin('billingstrategy', 'billingstrategy_mapping.strategyid', 'billingstrategy.strategyid')
            .select('billingstrategy_mapping.entity_type', 'billingstrategy_mapping.entity_id')
            .where({ 'billingstrategy.strategyid': strategyid });
        if (Array.isArray(applicableEntities) && applicableEntities.length > 0) {
            const entityPromises = applicableEntities.map(async (entity) => {
                const information = await this.getEntityInfo(tenantId, entity.entity_type, entity.entity_id);
                if (information && Array.isArray(information) && information.length > 0) {
                    return Object.assign({ entity_type: entity.entity_type }, information[0]);
                }
                if (information && typeof information === "object" && Object.keys(information).length > 0) {
                    return Object.assign({ entity_type: entity.entity_type }, information);
                }
                return null;
            });
            applicableEntities = await Promise.all(entityPromises)
                .then(results => results.filter(result => result !== null));
        }
        return Object.assign(Object.assign({}, strategy), { description: strategy.description || null, valid_from: strategy.valid_from || null, valid_until: strategy.valid_until || null, applicableTest: applicableTest.map(test => ({
                testid: test.testid,
                concessionValue: test.concessionValue,
                discountedValue: test.discountedValue,
                concessionMode: test.concessionMode,
                pricingType: test.pricingType,
                actualPrice: test.actualPrice || 0,
                name: test.name,
                originalPrice: test.originalPrice || 0
            })), applicableEntities });
    }
    async getBillingStrategy(tenantId, strategyid) {
        try {
            const strategy = await this.sanitizeToFieldsOfStrategy(strategyid, tenantId);
            return strategy || null;
        }
        catch (error) {
            return null;
        }
    }
    async updateBillingStrategy(tenantId, strategyid, updates) {
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const updated = await connection('billingstrategy')
                .where({ strategy_id: strategyid })
                .update(Object.assign(Object.assign({}, updates), { is_expired: updates.valid_until ? new Date(updates.valid_until) < new Date() : false, updated_on: connection.fn.now() }));
            return updated > 0 ? 'updated successfully' : 'no update occurred';
        }
        catch (error) {
            return error.message || 'unknown error occurred';
        }
    }
    async deleteBillingStrategy(tenantId, strategyid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            await connection.transaction(async (trx) => {
                await trx('billingstrategy_tests').where({ strategyid }).del();
                await trx('billingstrategy_mapping').where({ strategyid }).del();
                await trx('billingstrategy').where({ strategyid }).del();
            });
            return true;
        }
        catch (error) {
            console.error(error);
            throw new Error(`Failed to delete billing strategy: ${error.message}`);
        }
    }
    async getAllBillingStrategies(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const strategies = await connection('billingstrategy').select('*');
        return Promise.all(strategies.map(strategy => this.sanitizeToFieldsOfStrategy(strategy.strategyid, tenantId)));
    }
    async getAllBillingStrategiesWithoutApplicableTest(tenantId, count = 10, page = 1) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const strategies = await connection('billingstrategy')
            .select('*').limit(count).offset((page - 1) * count);
        return strategies;
    }
    async getBillingStrategyByEntity(tenantId, entity_type, entity_id, isvalidonly = false) {
        if (!entity_type || !entity_id) {
            throw new Error('Entity type and ID are required.');
        }
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const query = connection('billingstrategy_mapping as m')
            .join('billingstrategy as s', 's.strategyid', 'm.strategyid')
            .where({ 'm.entity_type': entity_type, 'm.entity_id': entity_id, 's.is_expired': 0 });
        if (isvalidonly) {
            query.whereRaw('s.valid_from IS NULL OR s.valid_from <= CURRENT_TIMESTAMP')
                .whereRaw('s.valid_until IS NULL OR s.valid_until >= CURRENT_TIMESTAMP');
        }
        const strategies = await query.select('s.*');
        return Promise.all(strategies.map(strategy => this.sanitizeToFieldsOfStrategy(strategy.strategyid, tenantId)));
    }
    async entityHasStrategy(tenantId, entity_type, entity_id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const exists = await connection('billingstrategy_mapping')
            .where({ entity_type, entity_id })
            .first();
        return !!exists;
    }
    async getProvidentialBillingHandler(tenantId, entity_type, associatedid) {
        try {
            if (!entity_type || !associatedid) {
                throw new Error('Entity type and associated ID are required.');
            }
            const strategyList = await this.getBillingStrategyByEntity(tenantId, entity_type, associatedid);
            if (strategyList.length === 0)
                return [];
            const { concessionMode, concessionValue, allConcessionApplied, applicableTest } = strategyList[0];
            const isTruthy = (value) => value === 1;
            const allTest = await new customTestEntry_1.CustomTest(null, null).loadTestWithDetails(tenantId);
            if (isTruthy(allConcessionApplied) && allTest.length) {
                const billingTestList = await Promise.all(allTest.map(async ({ price, name, testid, id }) => {
                    const discountedValue = this.calculateDiscountedValue(price, concessionMode, concessionValue, strategyList[0].price_type);
                    return {
                        discountedValue,
                        price,
                        name,
                        id,
                        testid,
                        concessionMode,
                        actualPrice: price,
                        originalPrice: price,
                        concessionValue
                    };
                }));
                return billingTestList;
            }
            if (applicableTest && applicableTest.length > 0) {
                const connection = await (0, KnexConnections_1.default)(tenantId);
                const testDetails = await connection('test_panels')
                    .select('id', 'price', 'name')
                    .whereIn('id', applicableTest.map(test => test.testid));
                const formattedApplicableTest = applicableTest.map(test => {
                    const matchedTest = testDetails.find(t => t.id === test.testid);
                    if (matchedTest) {
                        const { price, name, id } = matchedTest;
                        const discountedValue = this.calculateDiscountedValue(test.originalPrice, test.concessionMode, test.concessionValue, test.pricingType);
                        return {
                            discountedValue,
                            price,
                            name,
                            id,
                            testid: test.testid,
                            concessionMode: test.concessionMode,
                            concessionValue: test.concessionValue,
                            actualPrice: test.actualPrice,
                            originalPrice: test.originalPrice,
                            pricingType: test.pricingType
                        };
                    }
                    return null;
                }).filter((item) => item !== null);
                const reformattedTest = allTest
                    .filter(test => !applicableTest.some(apTest => apTest.testid === test.testid))
                    .map(({ price, name, testid, id }) => ({
                    discountedValue: price,
                    price,
                    name,
                    id,
                    testid,
                    concessionMode: 'absolute',
                    concessionValue: 0,
                    pricingType: 'discount',
                    actualPrice: price,
                    originalPrice: price
                }));
                return [...formattedApplicableTest, ...reformattedTest];
            }
            return allTest.map(({ price, name, testid, id }) => ({
                discountedValue: price,
                price,
                name,
                id,
                testid,
                concessionMode: 'absolute',
                concessionValue: 0,
                pricingType: 'discount',
                actualPrice: price,
                originalPrice: price
            }));
        }
        catch (error) {
            console.error('Error in getProvidentialBillingHandler:', error);
            throw new Error('Internal server error.');
        }
    }
    static async getStrategyBulkBillingData(tenantId, entity_type, entity_id) {
        try {
            if (!entity_type || !entity_id) {
                throw new Error('Entity type and ID are required.');
            }
            const strategyList = await new BillingStrategy().getBillingStrategyByEntity(tenantId, entity_type, entity_id);
            if (strategyList.length === 0)
                return [];
            const { concessionMode, concessionValue, allConcessionApplied, applicableTest } = strategyList[0];
            const isTruthy = (value) => value === 1;
            const allTest = await new customTestEntry_1.CustomTest(null, null).loadTestWithDetails(tenantId);
            if (isTruthy(allConcessionApplied) && allTest.length) {
                const billingTestList = await Promise.all(allTest.map(async ({ price, name, testid, id }) => {
                    const discountedValue = new BillingStrategy().calculateDiscountedValue(price, concessionMode, concessionValue, strategyList[0].price_type);
                    return {
                        discountedValue,
                        price,
                        name,
                        id,
                        testid,
                        concessionMode,
                        actualPrice: price,
                        originalPrice: price,
                        concessionValue
                    };
                }));
                return billingTestList;
            }
            if (applicableTest && applicableTest.length > 0) {
                const reformattedTest = allTest.map(({ price, name, testid }) => ({
                    discountedValue: price,
                    name,
                    testid,
                    id: testid,
                    concessionValue: 0,
                    concessionMode: 'absolute',
                    pricingType: 'discount',
                    actualPrice: price,
                    originalPrice: price
                }));
                const formattedApplicableTest = applicableTest
                    .map(({ testid, concessionMode, concessionValue, pricingType, actualPrice, originalPrice }) => {
                    const matchedItem = allTest.find((field) => field.testid === testid);
                    if (matchedItem) {
                        const { price, name, id } = matchedItem;
                        const discountedValue = new BillingStrategy().calculateDiscountedValue(originalPrice, concessionMode, concessionValue, pricingType);
                        return {
                            discountedValue,
                            price,
                            name,
                            id,
                            testid,
                            concessionMode,
                            concessionValue,
                            actualPrice,
                            originalPrice,
                            pricingType
                        };
                    }
                    return null;
                })
                    .filter((item) => item !== null);
                const mergedTests = [
                    ...formattedApplicableTest,
                    ...reformattedTest.filter((reformattedItem) => !formattedApplicableTest.some((formattedItem) => formattedItem.testid === reformattedItem.testid))
                ];
                return mergedTests;
            }
            return [];
        }
        catch (error) {
            console.error('Error in getStrategyBulkBillingData:', error);
            throw new Error('Internal server error.');
        }
    }
    async getStrategySingleTestValue(tenantId, entity_type, entity_id, testid) {
        try {
            const strategyData = await this.getBillingStrategyByEntity(tenantId, entity_type, entity_id);
            if (!strategyData || strategyData.length === 0) {
                throw new Error('Billing strategy not found.');
            }
            const { applicableTest, concessionMode, concessionValue, allConcessionApplied } = strategyData[0];
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const test = await connection('test_panels')
                .select('id', 'price')
                .where('test_panels.id', testid)
                .first();
            if (!test) {
                return null;
            }
            const { price } = test;
            if (allConcessionApplied === 1) {
                const discountedValue = this.calculateDiscountedValue(price, concessionMode, concessionValue, strategyData[0].price_type);
                return { testid, price, discountedValue, actualPrice: price, originalPrice: price };
            }
            if (Array.isArray(applicableTest) && applicableTest.length > 0) {
                const applicableTestData = applicableTest.find((test) => +test.testid === +testid);
                if (applicableTestData) {
                    const { concessionMode, concessionValue, pricingType, actualPrice, originalPrice } = applicableTestData;
                    const discountedValue = this.calculateDiscountedValue(originalPrice, concessionMode, concessionValue, pricingType);
                    return { testid, price, discountedValue, actualPrice, originalPrice };
                }
                else {
                    return { testid, price, discountedValue: price, actualPrice: price, originalPrice: price };
                }
            }
            return null;
        }
        catch (error) {
            console.error('Error in getStrategySingleTestValue:', error);
            throw new Error('Internal server error.');
        }
    }
    async deleteStrategyApplicableEntities(tenantId, strategyId, entityId, entityType) {
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const strategy = await connection('billingstrategy_mapping')
                .where({ strategyid: strategyId, entity_id: entityId, entity_type: entityType }).del();
            return strategy > 0;
        }
        catch (error) {
            console.error('Error in deleteStrategyApplicableEntities:', error);
            throw new Error('Internal server error.');
        }
    }
}
exports.default = BillingStrategy;

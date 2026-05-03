"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const databaseErrors_1 = require("../../database/databaseErrors");
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
    async getEntityInfoWithId(tenantId, entity_type, entity_id) {
        const entityInfo = await this.getEntityInfo(tenantId, entity_type, entity_id);
        if (!entityInfo) {
            return null;
        }
        const formatEntity = (item) => {
            if (entity_type === 'clinician') {
                return { id: item.id, name: item.name, entity_type: 'clinician' };
            }
            if (entity_type === 'insurance' || entity_type === 'phis') {
                return { id: item.id, name: item.insuranceName, entity_type: 'insurance' };
            }
            if (entity_type === 'organization') {
                return { id: item.id, name: item.name, entity_type: 'organization' };
            }
            return item;
        };
        if (Array.isArray(entityInfo)) {
            return entityInfo.map(formatEntity);
        }
        return [formatEntity(entityInfo)];
    }
    calculateDiscountedValue(originalPrice, concessionMode, concessionValue, pricingType) {
        let discountedValue = concessionMode === 'absolute' ? concessionValue : (originalPrice * concessionValue) / 100;
        discountedValue = Math.max(0, discountedValue);
        const finalPrice = pricingType === 'discount' ? originalPrice - discountedValue : originalPrice + discountedValue;
        return Number((finalPrice < 0 ? (pricingType === 'discount' ? originalPrice : 0) : finalPrice).toFixed(2));
    }
    async validateApplicableTest(tenantId, applicableTest, allconcessionApplied) {
        try {
            if (!allconcessionApplied && !Array.isArray(applicableTest)) {
                throw new TypeError("Expected 'applicableTest' to be an array.");
            }
            if (!allconcessionApplied && applicableTest.length > 0) {
                const connection = await (0, KnexConnections_1.default)(tenantId);
                const validTests = await connection('test_panels')
                    .select('id', 'price').whereIn('id', applicableTest.map(item => item.testid));
                const mapped = applicableTest.filter(item => {
                    const test = validTests.find((valid) => valid.id === item.testid);
                    if (!test ||
                        !item.testid ||
                        typeof item.testid !== 'number' ||
                        item.concessionValue < 0 ||
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
        catch (error) {
            throw new Error('Error validating applicable tests: ' + error.message);
        }
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
        const { allconcessionApplied, concessionValue, concessionMode, price_type = 'discount', valid_from, valid_until, name, description, applicableTest, isNHIS } = data;
        if (!name || name.length > 100) {
            return 'Strategy name is required and must not exceed 100 characters.';
        }
        if (concessionValue < 0 || concessionValue > 9999.99) {
            return 'Concession value must be between 0 and 9999.99.';
        }
        let validatedApplicableTest = null;
        if (applicableTest && applicableTest.length > 0) {
            validatedApplicableTest = await this.validateApplicableTest(tenantId, applicableTest, allconcessionApplied);
            if (validatedApplicableTest === null) {
                return 'Invalid applicable tests provided.';
            }
        }
        return {
            allconcessionApplied: allconcessionApplied ? 1 : 0,
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
            applicableTest: validatedApplicableTest || [],
            isNHIS: data.isNHIS ? 1 : 0
        };
    }
    async checkNHISUniqueness(trx, isNHIS, strategyid) {
        if (isNHIS === 1) {
            const query = trx('billingstrategy').where({ isNHIS: 1 });
            if (strategyid) {
                query.whereNot('strategyid', strategyid);
            }
            const existingNHIS = await query.first();
            if (existingNHIS) {
                throw new Error('A billing strategy with NHIS already exists.');
            }
        }
    }
    async insertBillingStrategy(tenantId, requestBody) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            const strategyId = await connection.transaction(async (trx) => {
                var _a;
                const data = await this.sanitizeClinicianBillingData(tenantId, requestBody);
                if (typeof data === 'string')
                    throw new Error(data);
                await this.checkNHISUniqueness(trx, data.isNHIS);
                const insertedStrategyId = await trx('billingstrategy')
                    .insert({
                    name: data.name,
                    description: data.description,
                    allconcessionApplied: data.allconcessionApplied,
                    concessionValue: data.concessionValue,
                    concessionMode: data.concessionMode,
                    price_type: data.price_type,
                    valid_from: data.valid_from,
                    valid_until: data.valid_until,
                    is_expired: data.is_expired,
                    createdon: new Date(data.createdon),
                    updatedon: data.updatedon,
                    isNHIS: data.isNHIS
                });
                if (!insertedStrategyId) {
                    throw new Error('Failed to insert or update billing strategy.');
                }
                if (data.allconcessionApplied === 0 && ((_a = data.applicableTest) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    const insertData = data.applicableTest.map(test => ({
                        strategyid: insertedStrategyId,
                        testid: test.testid,
                        concessionValue: test.concessionValue,
                        discountedValue: test.discountedValue,
                        concessionMode: test.concessionMode,
                        pricingType: test.pricingType
                    }));
                    await trx('billingstrategy_tests')
                        .insert(insertData)
                        .onConflict(['strategyid', 'testid'])
                        .merge({
                        concessionValue: trx.raw('VALUES(concessionValue)'),
                        discountedValue: trx.raw('VALUES(discountedValue)'),
                        concessionMode: trx.raw('VALUES(concessionMode)'),
                        pricingType: trx.raw('VALUES(pricingType)')
                    });
                }
                return insertedStrategyId;
            });
            return parseInt(strategyId.toString());
        }
        catch (error) {
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                throw new Error(message);
            }
            else {
                throw error;
            }
        }
    }
    async addApplicableTests(tenantId, strategyid, applicableTest) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            const strategy = await connection('billingstrategy').where({ strategyid }).first();
            if (!strategy) {
                throw new Error('Billing strategy not found.');
            }
            if (strategy.allconcessionApplied === 1) {
                throw new Error('Cannot add applicable tests to a strategy with allconcessionApplied enabled.');
            }
            const validatedApplicableTest = await this.validateApplicableTest(tenantId, applicableTest, false);
            if (validatedApplicableTest === null) {
                throw new Error("applicableTest Not found or has invalid content" /* OperationsFailures.applicableTestNotFound */ + ' or invalid content of applicable Test');
            }
            await connection.transaction(async (trx) => {
                await trx('billingstrategy_tests').where('strategyid', strategyid).del();
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
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                throw new Error(`Failed to add applicable tests: ${message}`);
            }
            else {
                throw new Error(`Failed to add applicable tests: ${error.message}`);
            }
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
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                throw new Error(`Failed to add category to strategy: ${message}`);
            }
            else {
                throw new Error(`Failed to add category to strategy: ${error.message}`);
            }
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
            .leftJoin('testdetails', 'tp.id', 'testdetails.testid')
            .select('bst.testid', 'bst.concessionValue', 'bst.discountedValue', 'bst.concessionMode', 'bst.pricingType', 'tp.price as actualPrice', 'tp.price as originalPrice', 'tp.name', 'testdetails.isoutsourced')
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
    async updateBillingStrategy(tenantId, strategyid, requestBody) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            const result = await connection.transaction(async (trx) => {
                var _a;
                const existingStrategy = await trx('billingstrategy').where({ strategyid }).first();
                if (!existingStrategy) {
                    throw new Error('Billing strategy not found.');
                }
                const data = await this.sanitizeClinicianBillingData(tenantId, requestBody);
                if (typeof data === 'string')
                    throw new Error(data);
                await this.checkNHISUniqueness(trx, data.isNHIS, strategyid);
                await trx('billingstrategy')
                    .where({ strategyid })
                    .update({
                    name: data.name,
                    description: data.description,
                    allconcessionApplied: data.allconcessionApplied,
                    concessionValue: data.concessionValue,
                    concessionMode: data.concessionMode,
                    price_type: data.price_type,
                    valid_from: data.valid_from,
                    valid_until: data.valid_until,
                    is_expired: data.is_expired,
                    updatedon: trx.fn.now(),
                });
                if (data.allconcessionApplied === 0 && ((_a = data.applicableTest) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    const insertData = data.applicableTest.map(test => ({
                        strategyid,
                        testid: test.testid,
                        concessionValue: test.concessionValue,
                        discountedValue: test.discountedValue,
                        concessionMode: test.concessionMode,
                        pricingType: test.pricingType
                    }));
                    await trx('billingstrategy_tests').where('strategyid', strategyid).del();
                    await trx('billingstrategy_tests').insert(insertData);
                }
                else {
                    const itemTobeDeleted = Array.isArray(strategyid) ? strategyid : [strategyid];
                    await trx('billingstrategy_tests')
                        .whereIn('strategyid', itemTobeDeleted)
                        .del();
                }
                return 'updated successfully';
            });
            return result;
        }
        catch (error) {
            console.error(error);
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                return message;
            }
            else {
                return error.message;
            }
        }
    }
    async deleteBillingStrategy(tenantId, strategyid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            await connection.transaction(async (trx) => {
                await trx('billingstrategy_tests').where('strategyid', strategyid).del();
                await trx('billingstrategy_mapping').where('strategyid', strategyid).del();
                await trx('billingstrategy').where('strategyid', strategyid).del();
            });
            return true;
        }
        catch (error) {
            console.error(error);
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                throw new Error(message);
            }
            else {
                throw error;
            }
        }
    }
    async getAllBillingStrategies(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const strategies = await connection('billingstrategy').select('*');
        return Promise.all(strategies.map(strategy => this.sanitizeToFieldsOfStrategy(strategy.strategyid, tenantId)));
    }
    async getAllBillingStrategiesWithoutApplicableTest(tenantId, count = 10, page = 1, sortby) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const strategies = await connection('billingstrategy')
            .select('*').limit(count).offset((page - 1) * count).orderBy('createdon', sortby);
        return strategies;
    }
    async getBillingStrategyByEntity(tenantId, entity_type, entity_id) {
        if (!entity_type || !entity_id) {
            throw new Error('Entity type and ID are required.');
        }
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const query = connection('billingstrategy_mapping as m')
            .join('billingstrategy as s', 's.strategyid', 'm.strategyid')
            .whereRaw(`
                    m.entity_type = ?
                    AND m.entity_id = ?
                    AND (s.valid_from IS NULL OR s.valid_from <= CURRENT_TIMESTAMP)
                    AND (s.valid_until IS NULL OR s.valid_until >= CURRENT_TIMESTAMP)
               `, [entity_type, entity_id]);
        const strategies = await query.select('s.*');
        if (strategies.length === 0) {
            return [];
        }
        return Promise.all(strategies.map(strategy => this.sanitizeToFieldsOfStrategy(strategy.strategyid, tenantId)));
    }
    async entityHasStrategy(tenantId, entity_type, entity_id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const exists = await connection('billingstrategy_mapping')
            .where({ entity_type, entity_id })
            .first();
        return !!exists;
    }
    async loadAllTests(tenantId) {
        return await new customTestEntry_1.CustomTest(null, null).loadTestWithDetails(tenantId);
    }
    mapTestsWithDefaults(tests) {
        return tests.map(({ price, name, testid, id, isoutsourced }) => ({
            discountedValue: price,
            price,
            name,
            id,
            isoutsourced,
            testid,
            concessionMode: 'absolute',
            concessionValue: 0,
            pricingType: 'discount',
            actualPrice: price,
            originalPrice: price
        }));
    }
    async getProvidentialBillingHandler(tenantId, entity_type, associatedid, fallbackToDefault, isNHIS = false) {
        try {
            if (!entity_type) {
                throw new Error('Entity type required.');
            }
            if (entity_type !== "general" && !associatedid && entity_type != "nhis") {
                throw new Error('Associated ID required for non-general entities.');
            }
            if (entity_type === "general") {
                return this.mapTestsWithDefaults(await this.loadAllTests(tenantId));
            }
            let strategyList = [];
            if (entity_type === "nhis") {
                const connection = await (0, KnexConnections_1.default)(tenantId);
                const nhisStrategy = await connection('billingstrategy').where({ isNHIS: 1 }).first();
                if (nhisStrategy) {
                    strategyList = [await this.sanitizeToFieldsOfStrategy(nhisStrategy.strategyid, tenantId)];
                }
            }
            else {
                strategyList = await this.getBillingStrategyByEntity(tenantId, entity_type, associatedid);
            }
            if (entity_type === "nhis") {
            }
            if (!strategyList.length && !fallbackToDefault) {
                return `${"Billing strategy not found for the given entity." /* OperationsFailures.billingStrategyNotFoundForEntity */} or ${"Billing strategy has expired." /* OperationsFailures.billingStrategyExpired */}`;
            }
            const allTest = await this.loadAllTests(tenantId);
            const testMap = new Map(allTest.map(test => [test.testid, test]));
            if (!strategyList.length && fallbackToDefault) {
                return this.mapTestsWithDefaults(allTest);
            }
            const { concessionMode, concessionValue, allconcessionApplied, applicableTest, price_type } = strategyList[0];
            const isTruthy = (val) => val === 1;
            if (isTruthy(allconcessionApplied) && allTest.length) {
                return allTest.map(({ price, name, testid, id }) => ({
                    discountedValue: this.calculateDiscountedValue(price, concessionMode, concessionValue, price_type),
                    price,
                    name,
                    id,
                    testid,
                    concessionMode,
                    concessionValue,
                    actualPrice: price,
                    originalPrice: price
                }));
            }
            if (applicableTest && Array.isArray(applicableTest) && applicableTest.length > 0) {
                const applicableTestIds = applicableTest.map(test => test.testid);
                const formattedApplicableTest = applicableTest.map(test => {
                    var _a;
                    const matched = testMap.get(test.testid);
                    if (!matched)
                        return null;
                    return {
                        discountedValue: this.calculateDiscountedValue(test.originalPrice, test.concessionMode, test.concessionValue, test.pricingType),
                        price: matched.price,
                        name: matched.name,
                        id: matched.id,
                        testid: test.testid,
                        concessionMode: test.concessionMode,
                        concessionValue: test.concessionValue,
                        actualPrice: test.originalPrice,
                        isoutsourced: (_a = matched.isoutsourced) !== null && _a !== void 0 ? _a : false,
                        originalPrice: test.originalPrice,
                        pricingType: test.pricingType
                    };
                }).filter(Boolean);
                const remainingTests = allTest
                    .filter(test => !applicableTestIds.includes(test.testid))
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
                if (entity_type === "nhis") {
                    console.log('NHIS formattedApplicableTest:', formattedApplicableTest);
                    return formattedApplicableTest;
                }
                else {
                    return [...formattedApplicableTest, ...remainingTests];
                }
            }
            if (entity_type === "nhis") {
                return [];
            }
        }
        catch (error) {
            console.error('Error in getProvidentialBillingHandler:', error);
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                throw new Error(message);
            }
            else {
                throw new Error('Internal server error.');
            }
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
            const { concessionMode, concessionValue, allconcessionApplied, applicableTest } = strategyList[0];
            const isTruthy = (value) => value === 1;
            const allTest = await new customTestEntry_1.CustomTest(null, null).loadTestWithDetails(tenantId);
            if (isTruthy(allconcessionApplied) && allTest.length) {
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
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                throw new Error(message);
            }
            else {
                throw new Error('Internal server error.');
            }
        }
    }
    async getStrategySingleTestValue(tenantId, entity_type, entity_id, testid) {
        try {
            const strategyData = await this.getBillingStrategyByEntity(tenantId, entity_type, entity_id);
            if (!strategyData || strategyData.length === 0) {
                throw new Error('Billing strategy not found.');
            }
            const { applicableTest, concessionMode, concessionValue, allconcessionApplied } = strategyData[0];
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const test = await connection('test_panels')
                .select('id', 'price')
                .where('test_panels.id', testid)
                .first();
            if (!test) {
                return null;
            }
            const { price } = test;
            if (allconcessionApplied === 1) {
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
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                throw new Error(message);
            }
            else {
                throw new Error('Internal server error.');
            }
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
            if (error.code) {
                const { message } = (0, databaseErrors_1.getMySqlErrorMessage)(error.code);
                throw new Error(message);
            }
            else {
                throw new Error('Internal server error.');
            }
        }
    }
    async getProvidentialTestPrice(tenantId, entityType, entityId, testId, fallbackToDefault, trx = null) {
        var _a;
        const getDefaultPrice = async () => {
            const connection = trx || await (0, KnexConnections_1.default)(tenantId);
            const test = await connection('test_panels').where({ id: testId }).first();
            if (!test)
                throw new Error("Test not found");
            return test.price;
        };
        if (entityType === "general") {
            return getDefaultPrice();
        }
        const strategies = await this.getBillingStrategyByEntity(tenantId, entityType, entityId);
        if (!strategies || strategies.length === 0) {
            if (fallbackToDefault) {
                return getDefaultPrice();
            }
            throw new Error("No billing strategy found for entity and fallbackToDefault is false");
        }
        const strategy = strategies[0];
        let concessionMode = strategy.concessionMode || "absolute";
        let concessionValue = (_a = strategy.concessionValue) !== null && _a !== void 0 ? _a : 0;
        let pricingType = strategy.price_type || "discount";
        const isAllConcession = strategy.allconcessionApplied === 1;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const test = await connection('test_panels').where({ id: testId }).first();
        if (!test)
            throw new Error("Test not found");
        const basePrice = test.price;
        if (isAllConcession) {
            const discounted = this.calculateDiscountedValue(basePrice, concessionMode, concessionValue, pricingType);
            return discounted;
        }
        if (Array.isArray(strategy.applicableTest)) {
            for (const t of strategy.applicableTest) {
                if (t.testid === testId) {
                    const discounted = this.calculateDiscountedValue(basePrice, t.concessionMode, t.concessionValue, t.pricingType);
                    return discounted;
                }
            }
        }
        return basePrice;
    }
}
exports.default = BillingStrategy;

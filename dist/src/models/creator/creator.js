"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALERT_OPTIONS = exports.CONSTRAINTSLEVEL = void 0;
const testpanelList_1 = require("../../testpanel/testpanelList");
const queries_1 = require("./queries");
const registration_1 = __importDefault(require("../registration/registration"));
const ascension_1 = require("../operations/ascension");
const uuid_1 = require("uuid");
const helper_1 = require("../../hooks/helper");
const resultEncryptionReferer_1 = __importDefault(require("./resultEncryptionReferer"));
const TestCreationRulesRepository_1 = __importDefault(require("../TestCreation/TestCreationRulesRepository"));
const CriticalValueEvaluator_1 = require("./CriticalValueEvaluator");
const testFieldsCategoryClass_1 = __importDefault(require("../operations/testFieldsCategoryClass"));
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const encryptionModels_1 = require("../../utils/encryptionModels");
const requestAcess_1 = __importDefault(require("../security/RequestAcessResult/requestAcess"));
const RolesRepository_1 = __importDefault(require("../settings/users/RolesRepository"));
const appset_1 = __importDefault(require("../application/appsettings/appset"));
class Creator {
    constructor(testid) {
        this.testid = testid;
    }
    async getTestCreationRule(tenantId) {
        if (!this.testid)
            throw new Error("testid is required");
        const rule = await (0, helper_1.promisifyQuery)(tenantId, queries_1.testCreationRule, [this.testid]);
        if (rule.length > 0 && rule[0].creationrule !== "{}") {
            const result = JSON.parse(rule[0].creationrule);
            return result;
        }
        return [];
    }
    async getPreviousRecords(tenantId, testid, billingid, patientid) {
        const previousRecords = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM test_results WHERE billingid = ? AND patientid = ? AND testid  = ?`, [
            billingid,
            patientid,
            testid
        ]);
        return previousRecords;
    }
    static async getRecordedResultsUsingascensionId(tenantId, ascensionid) {
        const query = `SELECT * FROM test_results WHERE ascensionid = ?`;
        const records = await (0, helper_1.promisifyQuery)(tenantId, query, [ascensionid]);
        return records.length > 0 ? records : [];
    }
    hasContent(value) {
        return value !== undefined && value !== null && value.toString().trim() !== '';
    }
    parseAgeVariationLimits(ageVariationLimits) {
        if (!ageVariationLimits)
            return null;
        try {
            const parsed = typeof ageVariationLimits === 'string' ? JSON.parse(ageVariationLimits) : ageVariationLimits;
            return parsed;
        }
        catch (_a) {
            return null;
        }
    }
    convertAgeToDays(age, specifier) {
        switch ((specifier || '').toLowerCase().trim()) {
            case 'day':
            case 'days':
                return age;
            case 'month':
            case 'months':
                return age * 30;
            case 'year':
            case 'years':
                return age * 365;
            default:
                return NaN;
        }
    }
    ageFallsInCategory(ageDays, category) {
        const minDays = this.convertAgeToDays(category.minAge, category.specifier);
        const maxDays = this.convertAgeToDays(category.maxAge, category.specifier);
        return Number.isFinite(minDays) && Number.isFinite(maxDays) && ageDays >= minDays && ageDays <= maxDays;
    }
    getAgeGroup(age, ageType, ageVariationLimits) {
        const parsedAge = Number(age);
        const normalizedType = (ageType || '').toLowerCase().trim();
        const config = this.parseAgeVariationLimits(ageVariationLimits);
        if (config && Number.isFinite(parsedAge)) {
            const ageDays = this.convertAgeToDays(parsedAge, normalizedType);
            if (Number.isFinite(ageDays)) {
                if (config.neonates && this.ageFallsInCategory(ageDays, config.neonates))
                    return 'neonate';
                if (config.children && this.ageFallsInCategory(ageDays, config.children))
                    return 'child';
                if (config.adults && this.ageFallsInCategory(ageDays, config.adults))
                    return 'adult';
            }
        }
        if (!Number.isFinite(parsedAge))
            return 'adult';
        if ((normalizedType === 'day' || normalizedType === 'days') && parsedAge <= 28) {
            return 'neonate';
        }
        if (normalizedType === 'day' || normalizedType === 'days' ||
            normalizedType === 'month' || normalizedType === 'months' ||
            ((normalizedType === 'year' || normalizedType === 'years') && parsedAge < 18)) {
            return 'child';
        }
        return 'adult';
    }
    applyDemographicLimits(rule, gender, ageGroup) {
        if (rule.plan !== 'limits')
            return rule;
        const normalizedGender = (gender || '').toLowerCase().trim();
        const normalizedRule = Object.assign({}, rule);
        if (normalizedGender === 'female') {
            if (this.hasContent(rule.upperLimitFemale))
                normalizedRule.upperlimit = rule.upperLimitFemale;
            if (this.hasContent(rule.lowerLimitFemale))
                normalizedRule.lowerlimit = rule.lowerLimitFemale;
            return normalizedRule;
        }
        if (normalizedGender === 'male') {
            if (ageGroup === 'neonate') {
                if (this.hasContent(rule.upperLimitNeonates))
                    normalizedRule.upperlimit = rule.upperLimitNeonates;
                if (this.hasContent(rule.lowerLimitNeonates))
                    normalizedRule.lowerlimit = rule.lowerLimitNeonates;
                return normalizedRule;
            }
            if (ageGroup === 'child') {
                if (this.hasContent(rule.upperLimitChildren))
                    normalizedRule.upperlimit = rule.upperLimitChildren;
                if (this.hasContent(rule.lowerLimitChildren))
                    normalizedRule.lowerlimit = rule.lowerLimitChildren;
                return normalizedRule;
            }
            if (this.hasContent(rule.upperLimitMale))
                normalizedRule.upperlimit = rule.upperLimitMale;
            if (this.hasContent(rule.lowerLimitMale))
                normalizedRule.lowerlimit = rule.lowerLimitMale;
        }
        return normalizedRule;
    }
    async getPreviousRecordsOrCreationRule(tenantId, testid, billingid, patientid) {
        try {
            const [previousRecords, creationRules, patientBasicData, settings] = await Promise.all([
                this.getPreviousRecords(tenantId, testid, billingid, patientid),
                new TestCreationRulesRepository_1.default(tenantId).findByTestId(testid),
                new registration_1.default().getPatientBasicData(tenantId, patientid),
                new appset_1.default().getAllAppSettings(tenantId)
            ]);
            const patientGender = ((patientBasicData === null || patientBasicData === void 0 ? void 0 : patientBasicData.gender) || '').toString();
            const ageGroup = this.getAgeGroup(patientBasicData === null || patientBasicData === void 0 ? void 0 : patientBasicData.age, patientBasicData === null || patientBasicData === void 0 ? void 0 : patientBasicData.ageType, settings === null || settings === void 0 ? void 0 : settings.ageVariationLimits);
            const rulesWithLimits = creationRules.map(rule => this.applyDemographicLimits(rule, patientGender, ageGroup));
            if (previousRecords.length === 0) {
                return rulesWithLimits.map(item => {
                    item.fieldid = item.id;
                    return item;
                });
            }
            if (previousRecords.length > 0 && rulesWithLimits.length > 0) {
                const mappings = rulesWithLimits.map(rule => {
                    const previous = previousRecords.find((item) => item.fieldid === rule.id);
                    const state = previous ? Object.assign(Object.assign({}, rule), previous) : Object.assign(Object.assign({}, rule), { value: (0, encryptionModels_1.encrypt_value)('NIL'), originalvalue: (0, encryptionModels_1.encrypt_value)('NIL'), fieldid: rule.id, field: rule.name });
                    return state;
                });
                return mappings;
            }
        }
        catch (err) {
        }
    }
    async getPreviousRecordsWithTestRuleMapped(tenantId, testid, billingid, patientid) {
        try {
            const [previousRecords, creationRules] = await Promise.all([
                this.getPreviousRecords(tenantId, testid, billingid, patientid),
                new TestCreationRulesRepository_1.default(tenantId).findByTestId(testid)
            ]);
            if (!Array.isArray(previousRecords) || previousRecords.length === 0 ||
                !Array.isArray(creationRules) || creationRules.length === 0) {
                return null;
            }
            const mappings = previousRecords.map(item => {
                const matchingRule = creationRules.find(rule => rule.id === item.fieldid);
                return matchingRule ? Object.assign(Object.assign({}, matchingRule), item) : null;
            });
            return mappings.filter(Boolean);
        }
        catch (error) {
            console.error('Error in getPreviousRecordsWithTestRuleMapped:', error);
            throw new Error('Failed to map previous records with test rules');
        }
    }
    async getResultEntryTest(tenantId, scvid, ptid, target) {
        if (typeof target == "string")
            target = target.split(",");
        const patientid = parseInt(ptid.slice(target[1]));
        const billingid = parseInt(scvid.slice(target[0]));
        const patientdata = await new registration_1.default().getPatientBasicData(tenantId, patientid);
        if (patientdata === null)
            return "such id not found" /* OperationsFailures.unfoundID */ + '. Patient Not Found';
        const collection = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_test_ascension_name_and_id, [billingid]);
        if (collection.length > 0) {
            return { personal_data: patientdata, test: collection || [] };
        }
        return { personal_data: patientdata || {}, test: collection || [] };
    }
    async getResultEntryRecords(tenantId, testid, billingid, patientid) {
        try {
            let hasDrugs = false;
            const parsedBillingid = parseInt(billingid.toString());
            const parsedPatientid = parseInt(patientid.toString());
            const testname = await testpanelList_1.testpanel.getTestUsingTestid(tenantId, testid);
            if (!testname)
                return "such id not found" /* OperationsFailures.unfoundID */;
            let previousRecords = await this.getPreviousRecordsOrCreationRule(tenantId, testid, parsedBillingid, parsedPatientid);
            if (!previousRecords || !Array.isArray(previousRecords)) {
                return { result: [], testname: null, hasDrugs: false, testInfo: null };
            }
            if (previousRecords.length === 0)
                return { result: [], testname: null, hasDrugs: false, testInfo: null };
            hasDrugs = await this.hasDrugAssociatedWithTest(tenantId, testid, hasDrugs);
            return { result: previousRecords, testname, hasDrugs, testInfo: null };
        }
        catch (err) {
            throw err;
        }
    }
    async getCustomPreviousRecords(tenantId, testid, billingid, patientid) {
        try {
            let hasDrugs = false;
            const parsedBillingid = parseInt(billingid.toString());
            const parsedPatientid = parseInt(patientid.toString());
            const testInfo = await testpanelList_1.testpanel.getTestInfo(tenantId, testid);
            const testname = testInfo.name;
            if (!testname)
                return "such id not found" /* OperationsFailures.unfoundID */;
            let previousRecords = await this.getPreviousRecordsWithTestRuleMapped(tenantId, testid, parsedBillingid, parsedPatientid);
            if (!Array.isArray(previousRecords) || previousRecords.length === 0)
                return { result: [], testname: null, hasDrugs: false, testInfo: null };
            const testDetails = await testpanelList_1.testpanel.getTestDetails(tenantId, testid);
            hasDrugs = await this.hasDrugAssociatedWithTest(tenantId, testid, hasDrugs);
            const hasGenderVariation = testDetails ? testDetails['hasGenderVariation'] : false;
            const packet = await (0, helper_1.promisifyQuery)(tenantId, queries_1.getGenderQuery, [patientid]);
            const clientGender = packet.length > 0 ? packet[0]["gender"] : "";
            const clientAge = packet.length > 0 ? packet[0]["age"] : undefined;
            const clientAgeType = packet.length > 0 ? packet[0]["agetype"] : undefined;
            const settings = await new appset_1.default().getAllAppSettings(tenantId);
            const ageGroup = this.getAgeGroup(clientAge, clientAgeType, settings === null || settings === void 0 ? void 0 : settings.ageVariationLimits);
            console.log({ ageGroup, clientAge, clientAgeType });
            previousRecords = previousRecords.map(item => this.applyDemographicLimits(item, clientGender, ageGroup));
            if (hasGenderVariation && clientGender) {
                previousRecords = previousRecords.map((item) => {
                    const obj = Object.assign({}, item);
                    if (item[clientGender]) {
                        obj.upperlimit = item[clientGender].upperlimit;
                        obj.lowerlimit = item[clientGender].lowerlimit;
                        delete obj.female;
                        delete obj.male;
                    }
                    return obj;
                });
            }
            const testdetailcategory = await testFieldsCategoryClass_1.default.getByTestId(tenantId, testid);
            return { testname, result: previousRecords, hasDrugs, testInfo, testdetailcategory };
        }
        catch (err) {
            throw err;
        }
    }
    async resultPresentationView(tenantId, testid, billingid, patientid) {
        const resultDataset = await this.getCustomPreviousRecords(tenantId, testid, billingid, patientid);
        if (typeof resultDataset == "string")
            return resultDataset;
        const { result, hasDrugs, testname, testInfo, testdetailcategory } = resultDataset;
        if (result && Array.isArray(result) && result.length > 0) {
            let resultOmissionMaleFemale = result.map((item, index) => {
                const { female, male, isValueTracked, type, valueAlert, useplain, alert, constraint } = item, rest = __rest(item, ["female", "male", "isValueTracked", "type", "valueAlert", "useplain", "alert", "constraint"]);
                return rest;
            });
            return {
                result: resultOmissionMaleFemale,
                hasDrugs,
                testname,
                testInfo,
                testdetailcategory: testdetailcategory || null
            };
        }
        return [];
    }
    async hasDrugAssociatedWithTest(tenantId, testid, hasDrugs) {
        let testDetails = await testpanelList_1.testpanel.getPanelEditSingle(tenantId, testid);
        if (Array.isArray(testDetails) && testDetails.length > 0) {
            const iHasDrugs = testDetails[0]['hasDrugs'];
            hasDrugs = iHasDrugs == 1 ? true : false;
        }
        return hasDrugs;
    }
    async getCustomCommentsRecords(tenantId, billingid, testid) {
        if (!billingid || !testid) {
            throw new Error("testid and billingid required");
        }
        let comments = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_comments_query, [billingid, testid]);
        return comments.length > 0 ? comments[0]["comments"] : "";
    }
    async createUltrasoundTemplateTable(tenantId, tablename) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.modify_ultrasound_field_to_support_long_text);
    }
    async updateTestCreationRule(tenantId, data) {
        if (!this.testid || !data)
            throw new Error("testid and data is required");
        const stringdata = JSON.stringify(data);
        const isUpdated = await (0, helper_1.promisifyQuery)(tenantId, queries_1.update_creation_query, [stringdata, this.testid]);
        const isUltrasoundScan = await testpanelList_1.testpanel.isTestUltrasoundScanCategory(tenantId, this.testid);
        if (isUltrasoundScan) {
            const tableName = testpanelList_1.testpanel.generateTableNameUsingTestid(this.testid);
            this.createUltrasoundTemplateTable(tenantId, tableName);
        }
        return (0, helper_1.rowAffected)(isUpdated);
    }
    sanitize_patientid_billingid_query(csvid, ptid, target) {
        if (typeof target != "string" && !Array.isArray(target))
            throw new TypeError("Array or string separated by delimeter , required");
        let splitter = target;
        if (typeof target == "string") {
            splitter = target.trim().split(",");
        }
        const ptsplitter = parseInt(splitter[1]);
        const blsplitter = parseInt(splitter[0]);
        let patientid = ptid.slice(ptsplitter);
        let billingid = csvid.slice(blsplitter);
        if (!isNaN(patientid) && !isNaN(billingid)) {
            patientid = parseInt(patientid);
            billingid = parseInt(billingid);
        }
        return { patientid: parseInt(patientid.toString()), billingid: parseInt(billingid) };
    }
    async resultEntry(tenantId, requestBody) {
        const { csvid, ptid, testid, fields, employeeid, comments, ascensionid, isScan, hasDrugs, drugs } = requestBody;
        if (!csvid || !ptid || !testid || !fields || (Array.isArray(fields) && fields.length == 0)) {
            return "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */;
        }
        let { billingid, patientid } = this.sanitize_patientid_billingid_query(csvid, ptid, "70,50");
        if (typeof billingid != "number" || typeof patientid != "number") {
            return "The type of request body is invalid" /* OperationsFailures.invalidRequestBodyType */;
        }
        const isPaymentStatusValid = await this.CheckPaymentStatus(tenantId, ascensionid);
        if (!isPaymentStatusValid) {
            throw new Error("Result entry not allowed for unpaid services");
        }
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const shouldCreateRecord = async function (tenantId, fieldid, ascensionId, testid) {
            const records = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM test_results WHERE ascensionid = ? AND testid = ? AND fieldid = ?`, [
                ascensionId, testid, fieldid
            ]);
            return Array.isArray(records) && records.length === 0;
        };
        const insertUpdate = async function (trx, tenantId, fields, testid) {
            const cryptedValues = await (0, resultEncryptionReferer_1.default)(fields);
            if (!(cryptedValues === null || cryptedValues === void 0 ? void 0 : cryptedValues.resources))
                throw new Error("Encryption failed");
            const { resources } = cryptedValues;
            const editSessionId = (0, uuid_1.v4)();
            const isAdmin = await new RolesRepository_1.default(tenantId).getEmployeeRole(employeeid);
            if (isAdmin == undefined)
                throw new Error("Employee not found");
            const iswithinWindow = isAdmin.toLowerCase() === 'admin' ? true : await requestAcess_1.default.verifyWindowPeriod(tenantId, ascensionid, employeeid, 'edit');
            await Promise.all(resources.map(async (item, index) => {
                const originalvalue = item.originalvalue;
                const isCreateRecord = await shouldCreateRecord(tenantId, item.fieldid, ascensionid, testid);
                if (isCreateRecord) {
                    return await insertRecord();
                }
                else {
                    return await updateRecord();
                }
                async function updateRecord() {
                    if (!iswithinWindow)
                        throw new Error("Edit window period has elapsed, you can no longer edit this result");
                    const updateRecords = `UPDATE test_results SET value = ?,updated_on =Now(),employeeid = ?,entrymode = ?,originalvalue = ? ,field = ? ,edit_session_id = ? WHERE ascensionid = ? AND fieldid = ? AND testid = ?`;
                    const result = await trx.raw(updateRecords, [item.value, employeeid, (item === null || item === void 0 ? void 0 : item.entrymode) || "manual", originalvalue, item.field, editSessionId, ascensionid, item.fieldid, testid]);
                    await ascension_1.TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryEnd', new Date(), employeeid);
                    return (0, helper_1.rowAffected)(result);
                }
                async function insertRecord() {
                    const values = [item.field, billingid, patientid, item.value, employeeid, (item === null || item === void 0 ? void 0 : item.entrymode) || "manual", originalvalue, item.fieldid, testid, ascensionid, editSessionId];
                    if (isScan)
                        await ascension_1.TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryStart', new Date(), employeeid);
                    const query = `INSERT INTO test_results (field,billingid,patientid,value,employeeid,entrymode,originalvalue,fieldid,testid,ascensionid,edit_session_id)
							VALUES(?,?,?,?,?,?,?,?,?,?,?)`;
                    const result = await trx.raw(query, values);
                    await ascension_1.TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryEnd', new Date(), employeeid);
                    return (0, helper_1.rowAffected)(result);
                }
            }));
            const pushCommentsQuery = `UPDATE result_comments SET comments = ? WHERE billingid = ? AND testid = ?`;
            const commentSection = async function () {
                const isRecordAvailable = await trx.raw(`SELECT * FROM result_comments WHERE testid = ? AND billingid = ?`, [
                    testid,
                    billingid,
                ]);
                if (Array.isArray(isRecordAvailable[0]) && isRecordAvailable[0].length > 0) {
                    const result = await trx.raw(pushCommentsQuery, [comments, billingid, testid]);
                    return (0, helper_1.rowAffected)(result);
                }
                else {
                    const result = await trx.raw(`INSERT INTO result_comments (testid,billingid,comments) VALUES (?,?,?)`, [testid, billingid, comments]);
                    return (0, helper_1.rowAffected)(result);
                }
            };
            const isCommented = await commentSection();
            return isCommented;
        };
        async function drugProcessor() {
            if (hasDrugs && drugs.length > 0) {
                let refinedDrugsArray = drugs.map((item, index) => { return Object.assign(Object.assign({}, item), { ascensionid, testid, sensitivity: item.sensitivity, drugid: item.id, reaction: item.sensitivity }); });
                let isDrugsInserted = await Creator.insertResultDrugReactionBulk(tenantId, refinedDrugsArray);
                if (isDrugsInserted) {
                    await ascension_1.TestAscension.incrementTestEditCount(tenantId, billingid, ascensionid);
                }
            }
            if (!hasDrugs) {
                await ascension_1.TestAscension.incrementTestEditCount(tenantId, billingid, ascensionid);
            }
        }
        try {
            await connection.transaction(async (trx) => {
                await insertUpdate(trx, tenantId, fields, testid);
                await drugProcessor();
                await ascension_1.TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassValidation', employeeid, trx);
            });
            await CriticalValueEvaluator_1.CriticalValueEvaluator.criticalValueDetermination(tenantId, testid, billingid, ascensionid, fields, employeeid);
            return true;
        }
        catch (error) {
            throw error;
        }
    }
    async CheckPaymentStatus(tenantId, ascensionid) {
        const appSettings = await new appset_1.default().getAllAppSettings(tenantId);
        const allowResultEnteringUpaid = (appSettings === null || appSettings === void 0 ? void 0 : appSettings.allowResultEnteringUpaid) || 0;
        if (allowResultEnteringUpaid === 1)
            return true;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const servicesData = connection('dboservices AS ds')
            .innerJoin('test_ascension AS ta', 'ds.serviceid', 'ta.serviceid')
            .select('paymentstatus')
            .where({ 'ta.id': ascensionid });
        const serviceRecord = await servicesData.first();
        if (serviceRecord && serviceRecord.paymentstatus !== 'paid' && allowResultEnteringUpaid === 0) {
            return false;
        }
        else {
            return true;
        }
    }
    static async logCriticalValue(tenantId, testid, billingid, statement, employeeid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.insert_critical_value_alert, [billingid, testid, statement, employeeid]);
        return (0, helper_1.rowAffected)(result);
    }
    static async createUltrasoundScanTemplateMapper(tenantId, template) {
        const { employeeid, name, testid, visibleToAll, associatedbodypart } = template;
        const insert = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_new_ultrasound_template_mapper, [testid, name, employeeid, visibleToAll, associatedbodypart]);
        return insert.insertId ? parseInt(insert.insertId) : false;
    }
    static async updateUltrasoundScanTemplateMapper(tenantId, template) {
        const { employeeid, name, testid, visibleToAll, associatedbodypart, keyid } = template;
        const updateRow = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_ultrasound_template_mapper, [name, employeeid, visibleToAll, associatedbodypart, keyid]);
        return (0, helper_1.rowAffected)(updateRow);
    }
    static async createUltrasoundTemplate(tenantId, template) {
        try {
            const { fields } = template;
            const templateId = await this.createUltrasoundScanTemplateMapper(tenantId, template);
            if (typeof templateId !== "number")
                return false;
            if (Array.isArray(fields) && fields.length > 0) {
                for (let i = 0; i < fields.length; i++) {
                    const { name, value, id } = fields[i];
                    await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_ultrasound_template, [templateId, name, value, id]);
                }
            }
            return true;
        }
        catch (error) {
            console.error("Error creating ultrasound template:", error);
            return false;
        }
    }
    static async updateUltrasoundTemplate(tenantId, template) {
        const { fields, keyid } = template;
        if (!keyid)
            return "The type of request body is invalid" /* OperationsFailures.invalidRequestBodyType */;
        const isUpdated = await this.updateUltrasoundScanTemplateMapper(tenantId, template);
        if (!isUpdated)
            return "Query execution failed." /* OperationsFailures.queryExecutionFailed */;
        if (Array.isArray(fields) && fields.length > 0) {
            for (let i = 0; i < fields.length; i++) {
                const { field, value } = fields[i];
                const hasField = await this.hasUltrasoundTemplateField(tenantId, keyid, field);
                if (hasField) {
                    await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_ultrasound_template, [field, value, keyid, field]);
                }
                else {
                    await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_ultrasound_template, [keyid, field, value]);
                }
            }
        }
        return true;
    }
    static async getUltrasoundTemplateField(tenantId, templateid, fieldName) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_ultrasound_template_field, [templateid, fieldName]);
        if (result.length === 0)
            return null;
        return result;
    }
    static async hasUltrasoundTemplateField(tenantId, templateid, fieldName) {
        const result = await this.getUltrasoundTemplateField(tenantId, templateid, fieldName);
        if (result === null)
            return false;
        return result.length > 0;
    }
    static async getUltrasoundTemplate(tenantId, templateId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_a_single_ultrasound_template, [templateId]);
        return result;
    }
    static async getUltrasoundTypeTemplates(tenantId, testid, count, page, employeeid) {
        return await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_get_ultrasound_template_mapper_scan_type, [employeeid, testid], tenantId);
    }
    static async getUltrasoundTemplateMapper(tenantId, templateid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_a_single_ultrasound_mapper, [templateid]);
        if (result.length === 0)
            return null;
        return result[0];
    }
    static async getUltrasoundTemplateSingleDetail(tenantId, templateid) {
        const template = await this.getUltrasoundTemplateMapper(tenantId, templateid);
        template.fields = await this.getUltrasoundTemplate(tenantId, templateid);
        return template;
    }
    static async getUltrasoundTemplatesAll(tenantId, count, page, employeeid) {
        return await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_get_ultrasound_template_mapper, [employeeid], tenantId);
    }
    static async getResultDrugReactions(tenantId, ascensionId, testid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_drug_reaction_inserts_find, [testid, ascensionId]);
    }
    static async updateResultDrugReactions(tenantId, reaction, ascensionId, testid) {
        let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_drug_reaction, [reaction, ascensionId, testid]);
        return (0, helper_1.rowAffected)(result);
    }
    static async hasResultDrugreactions(tenantId, ascensionId, testid, drugid) {
        const packets = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_has_drug_reaction_inserts, [testid, ascensionId, drugid]);
        return packets.length > 0;
    }
    static async insertResultDrugReaction(tenantId, drugRxn) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            const { drugid, sensitivity, ascensionid, testid } = drugRxn;
            const record = await connection.raw(`SELECT * FROM resultentrydrugsreaction WHERE ascensionid = ? AND testid = ? AND drugid = ? `, [ascensionid, testid, drugid]);
            const hasRecord = Array.isArray(record[0]) ? record[0].length > 0 : false;
            if (hasRecord) {
                const updateResult = await connection.raw(`UPDATE resultentrydrugsreaction SET reaction = ? WHERE ascensionid = ? AND testid = ? AND drugid = ?`, [sensitivity, ascensionid, testid, drugid]);
                return (0, helper_1.rowAffected)(updateResult[0]);
            }
            else {
                const insertResult = await connection.raw(`INSERT INTO resultentrydrugsreaction (drugid, reaction, ascensionid, testid) VALUES (?, ?, ?, ?)`, [drugid, sensitivity, ascensionid, testid]);
                return (0, helper_1.rowAffected)(insertResult[0]);
            }
        }
        catch (error) {
            console.error('Error inserting drug reaction:', error);
            return false;
        }
    }
    static async insertResultDrugReactionBulk(tenantId, drugs) {
        const insertPromises = drugs.map((item) => this.insertResultDrugReaction(tenantId, item));
        const results = await Promise.allSettled(insertPromises);
        const hasErrorOccurred = results.some((res) => res.status === 'rejected');
        // delete are records of that ascension  that is not in the drugs array
        const submittedDrugs = drugs.map(d => d.drugid).toString();
        await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM resultentrydrugsreaction WHERE drugid NOT IN (${submittedDrugs})`);
        return !hasErrorOccurred;
    }
}
exports.default = Creator;
exports.CONSTRAINTSLEVEL = [
    { value: 0, description: 'select an option here', symbol: '' },
    { value: 1, description: 'less than value', symbol: '<' },
    { value: 2, description: 'greater than value', symbol: '>' },
    { value: 3, description: 'match value', symbol: '=' },
    { value: 4, description: 'does not match value', symbol: '≠' }
];
exports.ALERT_OPTIONS = {
    0: 'select an option below',
    1: 'alert',
    2: 'do not alert',
    3: 'replace value with custom text'
};

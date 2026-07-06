"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeEventsSMSDataSource = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const clinicianClass_1 = __importDefault(require("../../../clincians/clinicianClass"));
const organization_1 = __importDefault(require("../../../organization/organization"));
const registration_1 = __importDefault(require("../../../registration/registration"));
const companyProfile_1 = require("../../../settings/companyProfile");
const Arkesel_1 = require("../../integrations/Arkesel");
const SmsMessageParser_1 = require("../PrimeSms/SmsMessageParser");
const PrimesmsEventsRepository_1 = require("./PrimesmsEventsRepository");
class PrimeEventsSMSDataSource {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.repo = new PrimesmsEventsRepository_1.PrimesmsEventsRepository(tenantId);
    }
    async isEventActive(eventCode) {
        const event = await this.repo.findByCode(eventCode);
        if (!event || typeof event.active === 'undefined')
            return false;
        return event.active === 1 || event.active === true;
    }
    async sendSMSMessage(smsconstent, phonee164, eventCode, refId, isevent, createdby) {
        try {
            const sms = await new Arkesel_1.SmsService().sendSms([phonee164], smsconstent);
            if (sms && sms.status === 'success' && Array.isArray(sms.data) && sms.data[0]) {
                await this.logSentSmsJob({
                    smsconstent,
                    phonee164,
                    arkeselResponse: sms,
                    eventCode,
                    refId,
                    isEvent: isevent,
                    eventcode: eventCode || null,
                    createdby: createdby
                });
            }
            return { status: sms.status || false };
        }
        catch (error) {
            console.error('Error sending SMS message:', error);
            return { status: false };
        }
    }
    async logSentSmsJob({ smsconstent, phonee164, arkeselResponse, eventCode, refId, isEvent = false, eventcode = null, createdby = 0 }) {
        // Import repositories dynamically to avoid circular dependencies
        const { PrimeSmsJobsRepo } = await Promise.resolve().then(() => __importStar(require('../repositories/PrimeSmsJobsRepo')));
        const { PrimeSmsJobRecipientsRepo } = await Promise.resolve().then(() => __importStar(require('../repositories/PrimeSmsJobRecipientsRepo')));
        const jobsRepo = new PrimeSmsJobsRepo(this.tenantId);
        let category = 'patient';
        if (eventCode) {
            try {
                const { EVENTS } = await Promise.resolve().then(() => __importStar(require('./EventsRepository')));
                const found = EVENTS.find(e => e.code === eventCode);
                if (found && found.category)
                    category = found.category;
            }
            catch (_a) {
                console.error('Error finding event category');
            }
        }
        // Use transaction for both job and recipient creation
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        await connection.transaction(async (trx) => {
            const jobId = await jobsRepo.create({
                custombody: smsconstent,
                category,
                recipientscope: 'single',
                targetids: null,
                sendtype: 'immediate',
                status: 'sent',
                createdby: 0
            }, trx);
            const arkeselData = arkeselResponse.data[0];
            let refidNum = null;
            if (typeof refId === 'number')
                refidNum = refId;
            else if (typeof refId === 'string' && /^\d+$/.test(refId))
                refidNum = parseInt(refId, 10);
            await trx('primesmsjobrecipients').insert({
                jobid: jobId,
                phonee164,
                personalizedbody: smsconstent,
                deliverystatus: 'sent',
                messageid: arkeselData.id,
                refid: refidNum,
                sentat: new Date(),
                isevent: isEvent == true ? 1 : 0,
                eventcode: eventcode || null,
            });
        });
    }
    async paymentConfirmationEvent(tenantId, billingid, employeeid) {
        try {
            const isActive = await this.isEventActive('PAYMENT_CONFIRMATION_SMS');
            if (!isActive)
                return;
            const query = `
            SELECT b.*, p.*
            FROM billing b
            JOIN new_patients p ON b.patientid = p.patientid
            WHERE b.billingid = ?
        `;
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const [result] = await connection.raw(query, [billingid]);
            if (!result || !result[0])
                return;
            const hxQuery = `
            SELECT * FROM billinghx  AS bhx
            INNER JOIN paymentmodes  ON bhx.PaymentMode = paymentmodes.KeyID
            WHERE billingid = ? ORDER BY bhx.KeyID DESC`;
            let billinghx = [];
            try {
                const [hxResult] = await connection.raw(hxQuery, [billingid]);
                billinghx = Array.isArray(hxResult) ? hxResult : [];
            }
            catch (e) {
                throw e;
            }
            let paymentSummary = '';
            if (billinghx.length > 0) {
                paymentSummary = billinghx.map(hx => `${hx.PaymentMode}: ${hx.Amount}`).join(', ');
            }
            const data = Object.assign(Object.assign({}, result[0]), { paymentSummary });
            const event = await this.repo.findByCode('PAYMENT_CONFIRMATION_SMS');
            if (!event)
                return;
            const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
            const smscontent = parsedContent + '';
            const phonee164 = result[0].mobile_number ? result[0].mobile_number.replace(/^\+/, '') : '';
            const refid = result[0].patientid;
            return await this.sendSMSMessage(smscontent, phonee164, 'PAYMENT_CONFIRMATION_SMS', refid, true, employeeid);
        }
        catch (error) {
            console.error('Error in paymentConfirmationEvent:', error);
            throw error;
        }
    }
    async parsedEventTemplate(tenantId, data, event) {
        const companyInfo = await (0, companyProfile_1.getAllCompanyProfiles)(tenantId);
        if (!data || !companyInfo)
            return;
        const merged = Object.assign(Object.assign(Object.assign({}, data), companyInfo), { companyname: companyInfo.name, companyphonenumber: companyInfo.phonenumber });
        return SmsMessageParser_1.SmsMessageParser.parse(event, merged);
    }
    async patientRegistrationEvent(tenantId, patientid, employeeId) {
        const isActive = await this.isEventActive('PATIENT_REGISTRATION_SMS');
        if (!isActive)
            return;
        const data = await new registration_1.default().getPatientBasicData(tenantId, patientid);
        const event = await this.repo.findByCode('PATIENT_REGISTRATION_SMS');
        if (!data || !event)
            return;
        const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
        let phonee164 = '';
        if ('phone' in data && data.phone)
            phonee164 = String(data.phone).replace(/^\+/, '');
        else if ('phonenumber' in data && data.phonenumber)
            phonee164 = String(data.phonenumber).replace(/^\+/, '');
        else if ('mobile' in data && data.mobile)
            phonee164 = String(data.mobile).replace(/^\+/, '');
        else if ('mobile_number' in data && data.mobile_number)
            phonee164 = String(data.mobile_number).replace(/^\+/, '');
        return await this.sendSMSMessage(parsedContent, phonee164, 'PATIENT_REGISTRATION_SMS', patientid, true, employeeId);
    }
    async patientBirthDayMessageLogging(tenantId, patientid, employeeId) {
        const isActive = await this.isEventActive('BIRTHDAY_SMS');
        if (!isActive)
            return;
        const data = await new registration_1.default().getPatientBasicData(tenantId, patientid);
        const event = await this.repo.findByCode('BIRTHDAY_SMS');
        if (!data || !event)
            return;
        const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
        let phonee164 = '';
        if ('phone' in data && data.phone)
            phonee164 = String(data.phone).replace(/^\+/, '');
        else if ('phonenumber' in data && data.phonenumber)
            phonee164 = String(data.phonenumber).replace(/^\+/, '');
        else if ('mobile' in data && data.mobile)
            phonee164 = String(data.mobile).replace(/^\+/, '');
        else if ('mobile_number' in data && data.mobile_number)
            phonee164 = String(data.mobile_number).replace(/^\+/, '');
        return await this.sendSMSMessage(parsedContent, phonee164, 'BIRTHDAY_SMS', patientid, true, employeeId);
    }
    async patientTransactionEventData(tenantId, billingid, employeeId) {
        const isActive = await this.isEventActive('PATIENT_BILLING_SMS');
        if (!isActive)
            return;
        const query = `
               SELECT b.*,p.*
               FROM billing b
               JOIN new_patients p ON b.patientid = p.patientid
               WHERE b.billingid = ?
          `;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const [result] = await connection.raw(query, [billingid]);
        if (!result || !result[0])
            return;
        const event = await this.repo.findByCode('PATIENT_BILLING_SMS');
        if (!event)
            return;
        const parsedContent = await this.parsedEventTemplate(tenantId, result[0], event.content);
        const phonee164 = result[0].mobile_number ? result[0].mobile_number.replace(/^\+/, '') : '';
        return await this.sendSMSMessage(parsedContent, phonee164, 'PATIENT_BILLING_SMS', result[0].patientid, true, employeeId);
    }
    async testAscensionEventDataAllDone(tenantId, billingid, createdby, ignoreAllMustPass = false, customMessage = null) {
        var _a;
        const isActive = await this.isEventActive('PATIENT_RESULT_READY');
        if (!isActive)
            return;
        // Get count of unapproved ascensions
        const query_verified = `
             SELECT COUNT(*) AS counter FROM test_ascension AS ta 
             INNER JOIN  dbotestresultapproval AS dta
                ON ta.id = dta.ascensionid
             WHERE isapproved = 0 AND ta.billingid = ?
          `;
        // Get billing summary
        const billing_query = `
             SELECT * FROM billing AS b 
             INNER JOIN new_patients AS p ON p.patientid = b.patientid WHERE billingid = ?
          `;
        // Get count of tests performed for this billing
        const test_count_query = `
             SELECT COUNT(*) AS test_count FROM test_ascension WHERE billingid = ?
          `;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const [ascensionResult] = await connection.raw(query_verified, [billingid]);
        const [billingResult] = await connection.raw(billing_query, [billingid]);
        const [testCountResult] = await connection.raw(test_count_query, [billingid]);
        const hasUnapproved = Array.isArray(ascensionResult) && ascensionResult.length > 0 && ascensionResult[0].counter > 0;
        if (!ignoreAllMustPass && !hasUnapproved)
            return;
        // If ignoreAllMustPass is true, always send the message
        const data = Object.assign(Object.assign({}, billingResult[0]), { test_count: ((_a = testCountResult[0]) === null || _a === void 0 ? void 0 : _a.test_count) || 0 });
        const event = await this.repo.findByCode('PATIENT_RESULT_READY');
        if (!event)
            return;
        const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
        const phonee164 = data.mobile_number ? data.mobile_number.replace(/^+/, '') : '';
        return await this.sendSMSMessage((customMessage ? customMessage : parsedContent), phonee164, 'PATIENT_RESULT_READY', data.billingid, true, createdby);
    }
    async sampleRejectionEvent(tenantId, ascensionid, employeeId) {
        const isActive = await this.isEventActive('SAMPLE_REJECTION_SMS');
        if (!isActive)
            return;
        const event = await this.repo.findByCode('SAMPLE_REJECTION_SMS');
        const connection = await (0, KnexConnections_1.default)(tenantId);
        let sample = await connection('samplestatus')
            .leftJoin('test_ascension', 'samplestatus.ascensionid', 'test_ascension.id')
            .leftJoin('test_panels', 'test_ascension.testid', 'test_panels.id')
            .leftJoin('billing', 'test_ascension.billingid', 'billing.billingid')
            .leftJoin('new_patients', 'billing.patientid', 'new_patients.patientid')
            .where({ ascensionid })
            .select('samplestatus.*', 'test_panels.name as testname', 'test_ascension.*', 'billing.*', 'new_patients.*')
            .first();
        if (!sample || !event)
            return;
        const parsedContent = await this.parsedEventTemplate(tenantId, sample, event.content);
        const phonee164 = sample.mobile_number ? sample.mobile_number.replace(/^\+/, '') : '';
        return await this.sendSMSMessage(parsedContent, phonee164, 'SAMPLE_REJECTION_SMS', ascensionid, true, employeeId);
    }
    async clinicianRegistrationEvent(tenantId, clinicianid, employeeId) {
        const isActive = await this.isEventActive('CLINICIAN_REGISTRATION_SMS');
        if (!isActive)
            return;
        const data = await new clinicianClass_1.default().getClinicianBasicInfo(tenantId, clinicianid);
        const event = await this.repo.findByCode('CLINICIAN_REGISTRATION_SMS');
        if (!data || !Array.isArray(data) || data.length === 0 || !event)
            return;
        const parsedContent = await this.parsedEventTemplate(tenantId, data[0], event.content);
        const phonee164 = (data[0].phone) ? String(data[0].phone).replace(/^\+/, '') : '';
        return await this.sendSMSMessage(parsedContent, phonee164, 'CLINICIAN_REGISTRATION_SMS', clinicianid, true, employeeId);
    }
    async organizationRegistrationEvent(tenantId, organizationid, employeeId) {
        const isActive = await this.isEventActive('ORGANIZATION_REGISTRATION_SMS');
        if (!isActive)
            return;
        const data = await new organization_1.default(organizationid).getOrganizationBasic(tenantId);
        const event = await this.repo.findByCode('ORGANIZATION_REGISTRATION_SMS');
        if (!data || !Array.isArray(data) || data.length === 0 || !event)
            return;
        const parsedContent = await this.parsedEventTemplate(tenantId, data[0], event.content);
        const phonee164 = data[0].phonenumber ? data[0].phonenumber.replace(/^\+/, '') : '';
        return await this.sendSMSMessage(parsedContent, phonee164, 'ORGANIZATION_REGISTRATION_SMS', organizationid, true, employeeId);
    }
    static async getClientResultReadySentcount(tenantId, billingid) {
        var _a;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection('primesmsjobrecipients')
            .where({ refid: billingid, eventcode: 'PATIENT_RESULT_READY' })
            .andWhere('deliverystatus', 'sent')
            .count('* as count');
        return Number(((_a = result[0]) === null || _a === void 0 ? void 0 : _a.count) || 0);
    }
    static async getSentSMSEventMessage(tenantId, eventCode, refid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return connection('primesmsjobrecipients')
            .where({ eventcode: eventCode, refid })
            .andWhere('deliverystatus', 'sent')
            .select('personalizedbody');
    }
}
exports.PrimeEventsSMSDataSource = PrimeEventsSMSDataSource;

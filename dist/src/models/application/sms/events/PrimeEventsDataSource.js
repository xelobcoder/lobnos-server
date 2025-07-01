"use strict";
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
const SmsMessageParser_1 = require("../PrimeSms/SmsMessageParser");
const PrimesmsEventsRepository_1 = require("./PrimesmsEventsRepository");
class PrimeEventsSMSDataSource {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.repo = new PrimesmsEventsRepository_1.PrimesmsEventsRepository(tenantId);
    }
    async paymentConfirmationEvent(tenantId, billingid) {
        // Get billing and patient info
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
        // Fetch billing history (hx)
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
            // If billinghx table or data is missing, ignore
        }
        // String together payment mode and amount from billinghx
        let paymentSummary = '';
        if (billinghx.length > 0) {
            paymentSummary = billinghx.map(hx => `${hx.PaymentMode}: ${hx.Amount}`).join(', ');
        }
        const data = Object.assign(Object.assign({}, result[0]), { paymentSummary });
        const event = await this.repo.findByCode('PAYMENT_CONFIRMATION_SMS');
        if (!event)
            return;
        const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
        // Append payment summary to the parsed content
        return parsedContent + (paymentSummary ? `\n\nPayment(s): ${paymentSummary}` : '');
    }
    async parsedEventTemplate(tenantId, data, event) {
        const companyInfo = await (0, companyProfile_1.getAllCompanyProfiles)(tenantId);
        if (!data || !companyInfo)
            return;
        const merged = Object.assign(Object.assign(Object.assign({}, data), companyInfo), { companyname: companyInfo.name, companyphonenumber: companyInfo.phonenumber });
        return SmsMessageParser_1.SmsMessageParser.parse(event, merged);
    }
    async patientRegistrationEvent(tenantId, patientid) {
        const data = await new registration_1.default().getPatientBasicData(tenantId, patientid);
        const event = await this.repo.findByCode('PATIENT_REGISTRATION_SMS');
        if (!data || !event)
            return;
        return this.parsedEventTemplate(tenantId, data, event.content);
    }
    async patientTransactionEventData(tenantId, billingid) {
        const query = `
               SELECT b.*,p.*
               FROM billing b
               JOIN new_patients p ON b.patientid = p.patientid
               WHERE b.billingid = ?
          `;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const [result] = await connection.raw(query, [billingid]);
        const event = await this.repo.findByCode('PATIENT_BILLING_SMS');
        return this.parsedEventTemplate(tenantId, result[0], event.content);
    }
    async testAscensionEventDataAllDone(tenantId, billingid) {
        var _a;
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
        if (!hasUnapproved)
            return;
        const data = Object.assign(Object.assign({}, billingResult[0]), { test_count: ((_a = testCountResult[0]) === null || _a === void 0 ? void 0 : _a.test_count) || 0 });
        const event = await this.repo.findByCode('PATIENT_RESULT_READY');
        return this.parsedEventTemplate(tenantId, data, event.content);
    }
    async sampleRejectionEvent(tenantId, ascensionid) {
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
        return this.parsedEventTemplate(tenantId, sample, event.content);
    }
    async clinicianRegistrationEvent(tenantId, clinicianid) {
        const data = await new clinicianClass_1.default().getClinicianBasicInfo(tenantId, clinicianid);
        const event = await this.repo.findByCode('CLINICIAN_REGISTRATION_SMS');
        if (!data || !Array.isArray(data) || data.length === 0 || !event)
            return;
        return this.parsedEventTemplate(tenantId, data[0], event.content);
    }
    async organizationRegistrationEvent(tenantId, organizationid) {
        const data = await new organization_1.default(organizationid).getOrganizationBasic(tenantId);
        const event = await this.repo.findByCode('ORGANIZATION_REGISTRATION_SMS');
        if (!data || !Array.isArray(data) || data.length === 0 || !event)
            return;
        return this.parsedEventTemplate(tenantId, data[0], event.content);
    }
}
exports.PrimeEventsSMSDataSource = PrimeEventsSMSDataSource;

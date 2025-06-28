"use strict";
// SmsMessageParser.ts
// Utility class for parsing and personalizing SMS message templates
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsMessageParser = void 0;
const clinicianClass_1 = __importDefault(require("../../../clincians/clinicianClass"));
const organization_1 = __importDefault(require("../../../organization/organization"));
const registration_1 = __importDefault(require("../../../registration/registration"));
const PrimeSmsJobsRepo_1 = require("../repositories/PrimeSmsJobsRepo");
const PrimeSmsTemplatesRepo_1 = require("../repositories/PrimeSmsTemplatesRepo");
class SmsMessageParser {
    constructor(tenantId, category, targetId) {
        this.tenantId = tenantId;
        this.category = category;
        this.targetId = targetId;
    }
    static parse(template, data) {
        if (!template || typeof template !== 'string')
            return '';
        return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
            return key in data ? String(data[key]) : '';
        });
    }
    async loadOrganizationData(organizationId) {
        return await new organization_1.default(organizationId).getOrganizationBasic(this.tenantId);
    }
    async loadPatientData(patientId) {
        console.log(await new registration_1.default().getPatientBasicData(this.tenantId, patientId));
        return await new registration_1.default().getPatientBasicData(this.tenantId, patientId);
    }
    async loadClinicianData(clinicianId) {
        return await new clinicianClass_1.default().getClinicianBasicInfo(this.tenantId, clinicianId);
    }
    loadCategoryData() {
        let datasource = {};
        switch (this.category) {
            case 'clinician':
                datasource = this.loadClinicianData(this.targetId);
                break;
            case 'patient':
                datasource = this.loadPatientData(this.targetId);
                break;
            case 'organization':
                datasource = this.loadOrganizationData(this.targetId);
                break;
            default:
                throw new Error(`Unknown category: ${this.category}`);
        }
        if (!datasource) {
            throw new Error(`No data found for category: ${this.category} with ID: ${this.targetId}`);
        }
        if (Array.isArray(datasource)) {
            return datasource.length > 0 ? datasource[0] : null;
        }
        return datasource;
    }
    async humanizeTemplate(jobId) {
        const job = typeof jobId === 'number' ? await new PrimeSmsJobsRepo_1.PrimeSmsJobsRepo(this.tenantId).findById(jobId) : jobId;
        if (!job) {
            throw new Error(`Job with ID ${jobId} not found`);
        }
        const { templateid } = jobId;
        if (!templateid) {
            throw new Error(`Job with ID ${jobId} does not have a template associated`);
        }
        const template = await new PrimeSmsTemplatesRepo_1.PrimeSmsTemplatesRepo(this.tenantId).findById(templateid);
        if (!template) {
            throw new Error(`Template with ID ${templateid} not found`);
        }
        const { category } = template;
        if (!category || category !== this.category) {
            throw new Error(`Template category ${category} does not match job category ${this.category}`);
        }
        const data = await this.loadCategoryData();
        if (!data) {
            throw new Error(`No data found for category: ${this.category} with ID: ${this.targetId}`);
        }
        return SmsMessageParser.parse(template.body, data);
    }
}
exports.SmsMessageParser = SmsMessageParser;

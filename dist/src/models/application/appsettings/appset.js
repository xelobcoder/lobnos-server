"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const Type_1 = require("./Type");
const helper_1 = require("../../../hooks/helper");
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class ApplicationSettings {
    async getAllAppSettings(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_application_setting);
        if (result.length > 0) {
            let record = result[0];
            record.services = (record === null || record === void 0 ? void 0 : record.services) != null ? (0, Type_1.jsonify)(record.services) : null;
            record.smsSettings = (record === null || record === void 0 ? void 0 : record.smsSettings) != null ? (0, Type_1.jsonify)(record.smsSettings) : null;
            record.billingsettings = (record === null || record === void 0 ? void 0 : record.billingsettings) != null ? (0, Type_1.jsonify)(record.billingsettings) : null;
            return record;
        }
        return null;
    }
    static async getLabRegionalAndDistrictCode(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return connection("applicationsettings")
            .select(["regioncode", "districtcode"])
            .where("keyid", 1)
            .first();
    }
    static async getLabRegionalAndDistrictCodeAbbreviations(tenantId) {
        const codeValues = await this.getLabRegionalAndDistrictCode(tenantId);
        if (!codeValues)
            return null;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection("districts")
            .join("regions", "regions.id", "districts.regionid")
            .where({ "districts.regionid": codeValues.regioncode, "districts.id": codeValues.districtcode })
            .select("*")
            .first();
        if (!result)
            return null;
        return { region: result.regioncode, district: result.code };
    }
    async getAppBillSettings(tenantId) {
        try {
            const settings = await this.getAllAppSettings(tenantId);
            if (!settings)
                return {
                    includeTax: 0, PaidBillsBeforeTransaction: 0, taxValue: 0
                };
            const { includeTax, PaidBillsBeforeTransaction } = settings;
            if (includeTax === 0) {
                return { includeTax, taxValue: 0, PaidBillsBeforeTransaction };
            }
            const getTax = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_active_tax);
            if (getTax.length == 0) {
                return { includeTax, taxValue: 0, PaidBillsBeforeTransaction };
            }
            else {
                const taxValue = getTax.reduce((a, b) => {
                    return a + b.value;
                }, 0);
                return {
                    includeTax,
                    taxValue: taxValue,
                    PaidBillsBeforeTransaction,
                };
            }
        }
        catch (err) {
            throw err;
        }
    }
    async applicationConnectedServices(tenantId) {
        const applicationSettings = await this.getAllAppSettings(tenantId);
        if (applicationSettings) {
            const settings = applicationSettings;
            if (settings && settings.services && settings.services != null) {
                const servicesString = settings['services'];
                if (typeof servicesString === "string") {
                    return (0, Type_1.jsonify)(servicesString);
                }
            }
        }
        return null;
    }
    async getEmailPreference(tenantId) {
        let data = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_email_pref);
        return data.length > 0 ? data[0] : [];
    }
    async shouldSendRejectionEmail(tenantId) {
        const settings = await this.getAllAppSettings(tenantId);
        let isServicesActivated = false;
        let isRejectedPrefered = false;
        if (settings && settings["emailNotification"] == 1) {
            isServicesActivated = true;
        }
        const rejectionPreference = await this.getEmailPreference(tenantId);
        if (!Array.isArray(rejectionPreference) && (rejectionPreference === null || rejectionPreference === void 0 ? void 0 : rejectionPreference.rejection) == "Yes") {
            isRejectedPrefered = true;
        }
        if (isRejectedPrefered && isServicesActivated) {
            return true;
        }
        return false;
    }
    async updateApplicationSettings(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const { bulkregistration, emailNotification, fontsize, textcolor, DeactivateBilling24hrs, BackgroundColor, PaidBillsBeforeTransaction, show_watermark, completeFlow, approvalbeforeprinting, includeTax, allowScientistToRegisterClient, services, AllowCrmToGiveDisocunt, withnessRefund, billingidPrefix, patientIdGenerationMethod, regioncode, billingsettings, districtcode, fontFamily, allowValidationUpaid, allowPrintingUnpaid, allowResultEnteringUpaid, byPassCollection, byPassSampleValidation, byPassValidation, byPassProcessing, automakesupplierpaymentsexpense, automakeemployeepayrollpaymentsexpense, automakeoutsourcepaymentsexpense, automakecommissionpaymentsexpense, pinOnResultEntry, pinOnResultValidation, useamountpaidforcommissioncalculation } = data;
        try {
            const result = await connection.transaction(async (trx) => {
                var _b;
                const existing = await trx('applicationsettings').where({ keyid: 1 }).first();
                const record = {
                    bulkregistration,
                    fontsize,
                    textcolor,
                    show_watermark: (_b = show_watermark !== null && show_watermark !== void 0 ? show_watermark : existing === null || existing === void 0 ? void 0 : existing.show_watermark) !== null && _b !== void 0 ? _b : 0,
                    BackgroundColor,
                    DeactivateBilling24hrs,
                    PaidBillsBeforeTransaction,
                    completeFlow,
                    approvalbeforeprinting,
                    emailNotification,
                    includeTax,
                    services: JSON.stringify(services),
                    AllowCrmToGiveDisocunt,
                    withnessRefund: withnessRefund,
                    billingidPrefix,
                    patientIdGenerationMethod,
                    regioncode,
                    districtcode,
                    billingsettings: billingsettings ? JSON.stringify(billingsettings) : null,
                    fontFamily: fontFamily || data.fontFamily || 'Arial',
                    allowResultEnteringUpaid: allowResultEnteringUpaid !== null && allowResultEnteringUpaid !== void 0 ? allowResultEnteringUpaid : 0,
                    allowPrintingUnpaid: allowPrintingUnpaid !== null && allowPrintingUnpaid !== void 0 ? allowPrintingUnpaid : 0,
                    allowValidationUpaid: allowValidationUpaid !== null && allowValidationUpaid !== void 0 ? allowValidationUpaid : 0,
                    byPassCollection: byPassCollection !== null && byPassCollection !== void 0 ? byPassCollection : 0,
                    byPassSampleValidation: byPassSampleValidation !== null && byPassSampleValidation !== void 0 ? byPassSampleValidation : 0,
                    byPassValidation: byPassValidation !== null && byPassValidation !== void 0 ? byPassValidation : 0,
                    byPassProcessing: byPassProcessing !== null && byPassProcessing !== void 0 ? byPassProcessing : 0,
                    automakesupplierpaymentsexpense: automakesupplierpaymentsexpense !== null && automakesupplierpaymentsexpense !== void 0 ? automakesupplierpaymentsexpense : 0,
                    automakeemployeepayrollpaymentsexpense: automakeemployeepayrollpaymentsexpense !== null && automakeemployeepayrollpaymentsexpense !== void 0 ? automakeemployeepayrollpaymentsexpense : 0,
                    automakeoutsourcepaymentsexpense: automakeoutsourcepaymentsexpense !== null && automakeoutsourcepaymentsexpense !== void 0 ? automakeoutsourcepaymentsexpense : 0,
                    automakecommissionpaymentsexpense: automakecommissionpaymentsexpense !== null && automakecommissionpaymentsexpense !== void 0 ? automakecommissionpaymentsexpense : 0,
                    useamountpaidforcommissioncalculation: useamountpaidforcommissioncalculation !== null && useamountpaidforcommissioncalculation !== void 0 ? useamountpaidforcommissioncalculation : 0,
                    pinOnResultEntry: pinOnResultEntry !== null && pinOnResultEntry !== void 0 ? pinOnResultEntry : 0,
                    pinOnResultValidation: pinOnResultValidation !== null && pinOnResultValidation !== void 0 ? pinOnResultValidation : 0,
                    allowScientistToRegisterClient: allowScientistToRegisterClient !== null && allowScientistToRegisterClient !== void 0 ? allowScientistToRegisterClient : 0,
                };
                let affectedRows = 0;
                if (existing) {
                    affectedRows = await trx('applicationsettings').where({ keyid: 1 }).update(record);
                }
                else {
                    affectedRows = await trx('applicationsettings').insert(Object.assign(Object.assign({}, record), { keyid: 1 }));
                }
                return affectedRows > 0;
            });
            return result;
        }
        catch (err) {
            console.log(err);
            throw err;
        }
    }
    async updateSmsSettings(tenantId, data) {
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_sms_settings, [data]));
    }
    async getSmsSettings(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_sms_settings);
        if (result.length == 0)
            return null;
        const { smsSettings } = result[0];
        return JSON.parse(smsSettings);
    }
    async updateEmailPreference(tenantId, data) {
        const { registration, rejection, result, approval, transactions, birthday, billing } = data;
        const truncate = (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_truncateEmailPreference));
        if (!truncate)
            return "operation failed" /* AppError.failed */;
        const values = [registration, result, rejection, approval, transactions, birthday, billing];
        const outcome = (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_email_preference, values));
        return outcome ? "success" /* AppError.success */ : "operation failed" /* AppError.failed */;
    }
    async getRegistrationSettings(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_registration_settings);
    }
    async updateRegisFields(tenantId, id, data, employeeid) {
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_reg_fields, [data, employeeid, id]));
    }
    async insertRegistrationSettings(tenantId, fields, employeeid) {
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_reg_settings, [JSON.stringify(fields), employeeid]));
    }
    async updateRegistrationFields(tenantId, data) {
        const { fields, employeeid } = data;
        if (!fields || !employeeid) {
            throw new ReferenceError("fields or employeeid not provided");
        }
        const previous = await this.getRegistrationSettings(tenantId);
        if (previous.length > 0) {
            const fieldid = previous[0]["id"];
            return await this.updateRegisFields(tenantId, fieldid, JSON.stringify(fields), employeeid);
        }
        else {
            return await this.insertRegistrationSettings(tenantId, fields, employeeid);
        }
    }
    async getGeneralEmailSettings(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_general_email_settings);
    }
    async updateGeneralEmailSettings(tenantId, records) {
        if (typeof records != "object")
            return false;
        const fields = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_truncateGeneralSettings);
        return (0, helper_1.rowAffected)(fields);
    }
    async isApprovalSetTrue(tenantId) {
        const result = await this.getAllAppSettings(tenantId);
        if (result) {
            const approval_status = result.approvalbeforeprinting;
            return !(parseInt(approval_status) === 0);
        }
        return false;
    }
}
_a = ApplicationSettings;
ApplicationSettings.updateApplicationBillSettings = async (tenantId, data) => {
    const connection = await (0, KnexConnections_1.default)(tenantId);
    const result = await connection("applicationsettings").update({
        "billingsettings": JSON.stringify(data)
    }).where({ "keyid": 1 });
    return result;
};
exports.default = ApplicationSettings;

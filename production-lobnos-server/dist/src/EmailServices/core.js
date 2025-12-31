"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const createEnv_1 = require("./createEnv");
const promises_1 = __importDefault(require("fs/promises"));
class Core {
    constructor() {
        this.isEnv = process.env.PROD_PLS_EMAIL_USER !== undefined &&
            process.env.PROD_PLS_EMAIL_PROVIDER !== undefined &&
            process.env.PROD_PLS_EMAIL_COMPANY !== undefined &&
            process.env.PROD_PLS_EMAIL_PASSWORD !== undefined;
        if (!this.isEnv) {
            throw new Error('System environment variables are missing');
        }
    }
    async sendBilledReceipt(filepath, email) {
        try {
            const mailOpts = {
                to: email,
                subject: 'Patient Billing Receipt',
                html: '<h5>Please find the attached billing receipt.</h5>',
                attachments: [
                    {
                        filename: 'patient-receipt.pdf',
                        path: filepath
                    }
                ]
            };
            const status = await this.createMailTransporter(mailOpts);
            await promises_1.default.unlink(filepath);
            return status && (status === null || status === void 0 ? void 0 : status.rejected.length) == 0;
        }
        catch (error) {
            console.error("Error in sendBilledReceipt:", error);
            return false;
        }
    }
    async sendClientResultEmailWithEncrytion(billingid) {
    }
    async createMailTransporter(mailOptions) {
        if (!this.isEnv)
            return "Production Variables not set" /* EFailures.ENV_VARIABLES_FAILED */;
        return (0, createEnv_1.createEmailTransport)(mailOptions);
    }
    async notificationPatientRegistration(patientid, email, callback) {
        throw new Error("Method not implemented.");
    }
    async notificationSampleRejection(data) {
        throw new Error("Method not implemented.");
    }
    async authenticationMailService(data) {
        throw new Error("Method not implemented.");
    }
    async notificationBillingReceipt(data) {
        throw new Error("Method not implemented.");
    }
    async verifyClientAuthenticationToken(token) {
        throw new Error("Method not implemented.");
    }
    async isEmailServicesActivated() {
        throw new Error("Method not implemented.");
    }
    async isMailChosenPatientNotic(patientid) {
        throw new Error("Method not implemented.");
    }
}
exports.default = Core;

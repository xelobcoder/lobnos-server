import { getBillingInvoiceData } from "../models/invoice/invoice";
import { createEmailTransport, EFailures, EmailService, Identifier, mailOptions, sampleRejection } from "./createEnv";
import fs from 'fs/promises';
import path from 'path';

export default class Core implements EmailService {
    private isEnv: boolean;

    constructor() {
        this.isEnv = process.env.PROD_PLS_EMAIL_USER !== undefined &&
            process.env.PROD_PLS_EMAIL_PROVIDER !== undefined &&
            process.env.PROD_PLS_EMAIL_COMPANY !== undefined &&
            process.env.PROD_PLS_EMAIL_PASSWORD !== undefined;
        if (!this.isEnv) {
            throw new Error('System environment variables are missing');
        }
    }



    async sendBilledReceipt(filepath: string, email: string): Promise<boolean> {
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
            await fs.unlink(filepath);

            return status && status?.rejected.length == 0;


        } catch (error) {
            console.error("Error in sendBilledReceipt:", error);
            return false;
        }
    }


    async sendClientResultEmailWithEncrytion(billingid: number) {

    }

    async createMailTransporter(mailOptions) {
        if (!this.isEnv) return EFailures.ENV_VARIABLES_FAILED;
        return createEmailTransport(mailOptions);
    }

    async notificationPatientRegistration(patientid: number, email: string, callback: any): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    async notificationSampleRejection(data: sampleRejection): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    async authenticationMailService(data: Identifier): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    async notificationBillingReceipt(data: any): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    async verifyClientAuthenticationToken(token: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    async isEmailServicesActivated(): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    async isMailChosenPatientNotic(patientid: number): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}

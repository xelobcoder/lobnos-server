"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNewBilling = void 0;
const helper_1 = require("../../../helper");
const billing_1 = require("../../models/billing/billing");
const billingclientTypes_1 = require("../../models/billing/billingclientTypes");
const trycatch_1 = require("../../models/generics/trycatch");
async function handleNewBilling(request, response) {
    async function validate() {
        const { patientid } = request.body;
        let bill = new billing_1.Billing(patientid).insertionProcess(request.body, false);
        if (typeof bill == "string" && bill == billingclientTypes_1.billErrors.already) {
            return response.send({ message: bill, statusCode: 200, status: "success" });
        }
        else if (typeof bill == "boolean" && bill) {
            return response.status(200).json({
                message: "billing successfully",
                statusCode: 200,
                status: "success",
            });
        }
        else {
            return (0, helper_1.customError)(billingclientTypes_1.billErrors.error, 400, response);
        }
    }
    (0, trycatch_1.wrapperTryCatch)(validate);
}
exports.handleNewBilling = handleNewBilling;

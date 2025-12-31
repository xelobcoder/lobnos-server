"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBillingInvoiceData = void 0;
const registration_1 = __importDefault(require("../registration/registration"));
const companyProfile_1 = require("../settings/companyProfile");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
async function getBillingInvoiceData(tenantId, billingid) {
    if (!billingid) {
        return {
            testInformation: [],
            clientInformation: {},
            companyInfo: {},
        };
    }
    try {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const testQuery = await connection.raw(`SELECT 
				dboservices.serviceid,
				dboservices.billingid,
				dboservices.trackId,
				dboservices.totalpayable,
				dboservices.totalcost,
				dboservices.discount,
				dboservices.amountIncurredDueTax,
				dboservices.cost,
				dboservices.employeeid,
				CASE 
					WHEN dboservices.categoryTrackId = 5 THEN 
						(SELECT serviceName FROM additionalservices WHERE keyid = dboservices.trackId)
					ELSE 
						(SELECT name FROM test_panels WHERE id = dboservices.trackId)
				END AS serviceName
			FROM dboservices 
			WHERE dboservices.billingid = ?`, [billingid]);
        const testInformation = testQuery[0] || [];
        const clientInformation = await new registration_1.default().getPatientInfoUsingBillingId(tenantId, billingid);
        const companyInfo = await (0, companyProfile_1.getAllCompanyProfiles)(tenantId);
        return {
            testInformation,
            clientInformation,
            companyInfo,
        };
    }
    catch (err) {
        console.error("Error fetching billing invoice data:", err);
        return {
            testInformation: [],
            clientInformation: { firstname: null },
            companyInfo: {},
        };
    }
}
exports.getBillingInvoiceData = getBillingInvoiceData;

import Registration from "../registration/registration";
import { getAllCompanyProfiles } from "../settings/companyProfile";
import KnexConnection from "../../database/KnexConnections";

type InvoiceType = {
	testInformation: Record<string, any>[];
	clientInformation: Record<string, any>;
	companyInfo: Record<string, any>;
};

async function getBillingInvoiceData(tenantId:number,billingid: number): Promise<InvoiceType> {
	if (!billingid) {
		return {
			testInformation: [],
			clientInformation: {},
			companyInfo: {},
		};
	}

	try {
		const connection = await KnexConnection(tenantId)
		const testQuery = await connection.raw(
			`SELECT 
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
			WHERE dboservices.billingid = ?`,
			[billingid]
		);

		const testInformation = testQuery[0] || [];

		const clientInformation = await new Registration().getPatientInfoUsingBillingId(tenantId,billingid);

		const companyInfo = await getAllCompanyProfiles(tenantId);

		return {
			testInformation,
			clientInformation,
			companyInfo,
		};
	} catch (err) {
		console.error("Error fetching billing invoice data:", err);
		return {
			testInformation: [],
			clientInformation: { firstname: null },
			companyInfo: {},
		};
	}
}

export { getBillingInvoiceData };

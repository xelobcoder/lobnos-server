import Organization from "../../models/organization/organization";
import { newOrganization, OperationsStatus, OrganizationRequestBody, OrgContactInfo, searchQueryParams } from "../../models/organization/OrgaInterfac";
import { getUploadedImages } from "./uploadImages";
import OrganizationalBilling from "../../models/organization/organizationBilling";
import { OrganizationAnalyticsRepository } from "../../models/organization/organization-analytics/organizationAnalyticsRepository";
import { HTTPSTATUSERRORS } from "../../Errors/HTTPErrors";
import { customError, responseError } from "../../hooks/helper";
import { Request, Response } from "express";
import { CreationRule } from "../../models/creator/creator-types";



export const getOrganizations = async (req: Request<{}, {}, {}, { tenantId: string }>, res: Response): Promise<void> => {
	try {
		const tenantIdP = parseInt(req.query.tenantId.toString())
		const organizations = await new Organization(null).getOrganizations(tenantIdP);
		res.status(200).json({ organizations });
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getOrganizationsBasic = async (request: Request<{}, {}, {}, { tenantId: string, id: string }>, response: Response): Promise<void> => {
	try {
		const { id } = request.query
		const tenantIdP = parseInt(request.query.tenantId.toString())
		if (!id) return customError(`organizationid required`, 404, response);
		const organizationalId = parseInt(id as string);
		const result = await new Organization(organizationalId).getOrganizationBasic(tenantIdP);
		response.send({ statusCode: 200, status: "success", result })
	} catch (error) {
		responseError(response, "Error occured getting organization info");
	}
};

export const getOrganizationsContact = async (req: Request<{}, {}, {}, { tenantId: string, id: string }>, res: Response): Promise<void> => {
	try {
		const tenantIdP = parseInt(req.query.tenantId.toString())
		const organizationsContact = await new Organization(parseInt(req.query.id.toString())).getOrganizationContact(tenantIdP);
		res.send(organizationsContact);
	} catch (error) {
		console.error("Error in getOrganizationsContact:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getOrganizationsPayment = async (request: Request<{}, {}, {}, { tenantId: string, id: string }>, response: Response): Promise<void> => {
	try {
		const organizationid = request.query.id;
		const tenantIdP = parseInt(request.query.tenantId.toString())
		if (!organizationid) return customError('Invalid request query param provided, organizationid missing', 400, response);
		const org_id = parseInt(organizationid.toString());
		const packets = await new Organization(org_id).getOrganizationalPayment(tenantIdP);
		response.send(packets)
	} catch (error) {
		responseError(response);
	}
};

export const deleteOrganization = async (request: Request<{}, {}, {}, { tenantId: string, id: number }>, response: Response): Promise<void> => {
	try {
		const { id } = request.query;
		console.log(request.query)
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const deletionStatus = await new Organization(parseInt(id.toString()))
			.deleteOrganization(tenantIdP)
		response.send({ status: deletionStatus });
	} catch (error) {
		console.error("Error in deleteOrganization:", error);
		responseError(response);
	}
};

export const getOrganizationWithDetails = async (request: Request<{}, {}, {}, { tenantId: string, id: string }>, response: Response): Promise<void> => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const organizationDetails = await new Organization(null).getOrganizationWithDetails(tenantIdP, request.query as searchQueryParams);
		response.send({ statusCode: 200, result: organizationDetails, status: "success" })
	} catch (error) {
		response.send({ error: "Internal server error" });
	}
};



export const uploadOrganizationProfilePicture = async (request: Request<{}, {}, {}, { tenantId: string }>, response: Response): Promise<void> => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		response.send({ status: HTTPSTATUSERRORS.HTTP_501_NOT_IMPLEMENTED })
	} catch (err) {
		console.log(err)
	}
}


export const getOrganizationImage = async (request: Request<{}, {}, {}, { tenantId: string, id: string }>, response: Response) => {
	try {
		const { id } = request.query;
		const filename = await getUploadedImages('organizations', id.toString());
		if (filename) {
			response.sendFile(filename)
		}
	} catch (err) {
		console.log(err);
	}
}

export const createAOrganization = async (request: Request<{}, {}, {}, { tenantId: string }>, response: Response) => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const isCreatedSuccess = await new Organization(null)
			.createAorganization(tenantIdP, request.body as OrganizationRequestBody);
		if (isCreatedSuccess === OperationsStatus.exist) {
			return response.send({ message: OperationsStatus.exist, status: 'exist' })
		}
		response.send({ message: isCreatedSuccess === true ? "Organization created successfully" : "creating a new organization failed", status: 'created' });
	} catch (error) {
		console.log(error)
		response.status(500).json({ error: "Internal server error" });
	}
};

export const updateOrganizationBasic = async (request: Request<{}, {}, newOrganization, { tenantId: string }>, response: Response): Promise<void> => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const organizationid = request.body.id;
		if (!organizationid) return responseError(response, 'Resource Identifier Not provided')
		const isUpdated = await new Organization(organizationid).updateOrganizationBasic(tenantIdP, request.body);
		response.status(200).json({ message: isUpdated ? "Organization basic information updated successfully" : "resource update failed" });
	} catch (error) {
		response.status(500).json({ error: "Internal server error" });
	}
};

export const updateOrganizationContact = async (request: Request<{}, {}, { organizationid: string | number }, { tenantId: string }>, response: Response): Promise<void> => {
	try {
		const { organizationid } = request.body;
		if (!organizationid) return customError('Invalid request body provided', 400, response);
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const isResourcesUpdated = await new Organization(parseInt(organizationid.toString())).updateOrganizationalContactInfo(tenantIdP, request.body as OrgContactInfo);
		response.send({ status: isResourcesUpdated, message: isResourcesUpdated ? "Organization contact information updated successfully" : "Organization contact information update failed" });
	} catch (error) {
		response.status(500).json({ error: "Internal server error" });
	}
};

export const updateOrganizationPayment = async (request: Request<{}, {}, { id: string | number }, { tenantId: string }>, response: Response): Promise<void> => {
	try {
		const { id } = request.body;
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const is_field_updated = await new Organization(parseInt(id.toString())).updateOrganizationPayment(tenantIdP, request.body);
		response.send({ status: is_field_updated })
	} catch (error) {
		response.status(500).json({ error: "Internal server error" });
	}
};

export const upload = async (req: Request<{}, {}, {}, { tenantId: string }>, res: Response): Promise<void> => {
	try {
		if (!req.file) {
			res.status(400).json({ error: "No file uploaded" });
		} else {
			res.status(200).json({ message: "File uploaded successfully" });
		}
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
};

export const dailyOrganizationCommission = async (request: Request<{}, {}, {}, { tenantId: string, organizationid: string }>, response: Response): Promise<void> => {
	try {
		const { organizationid } = request.query;
		if (!organizationid) return customError('organizationid not provided', 400, response);
		let id = parseInt(organizationid.toString());
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const commission = await new Organization(id).daySales(tenantIdP)
		response.send({ commission });
	} catch (error) {
		responseError(response);
	}
};

export const getOrganizationCommissionByMonth = async (request: Request<{}, {}, {}, { tenantId: string, organizationid: string }>, response: Response): Promise<void> => {
	try {
		const { organizationid } = request.query;
		if (!organizationid) return customError('organizationid not provided', 400, response);
		let id = parseInt(organizationid.toString());
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const commissionByMonth = await new Organization(id).monthSales(tenantIdP);
		response.send({ commissionByMonth });
	} catch (error) {
		responseError(response);
	}
};

export const getOrganizationsCommissionByDate = async (
	request: Request<{}, {}, {}, { tenantId: string, startDate: string, endDate: string, page?: string, count?: string, sortby?: 'ASC' | 'DESC' }>,
	response: Response
): Promise<void> => {
	try {
		const { startDate, endDate, page = '1', count = '10', sortby = 'DESC' } = request.query;
		const tenantIdP = parseInt(request.query.tenantId.toString());

		if (!startDate || !endDate) {
			return customError('startDate and endDate query params are required', 400, response);
		}

		const result = await OrganizationAnalyticsRepository.getOrganizationsCommissionByDate(tenantIdP, {
			startDate: startDate.toString(),
			endDate: endDate.toString(),
			page: parseInt(page.toString()),
			count: parseInt(count.toString()),
			sortby: sortby === 'ASC' ? 'ASC' : 'DESC'
		});

		response.send({ result });
	} catch (error) {
		responseError(response);
	}
};

export const getOrganizationCommission = async (
	request: Request<{}, {}, {}, { tenantId: string, organizationid: string, startDate: string, endDate: string }>,
	response: Response
): Promise<void> => {
	try {
		const { organizationid, startDate, endDate } = request.query;
		if (!organizationid || !startDate || !endDate) {
			return customError('organizationid, startDate and endDate query params are required', 400, response);
		}
		const tenantIdP = parseInt(request.query.tenantId.toString());
		const id = parseInt(organizationid.toString());

		const result = await OrganizationAnalyticsRepository.getOrganizationCommission(
			tenantIdP,
			id,
			startDate.toString(),
			endDate.toString()
		);
		response.send({ result });
	} catch (error) {
		responseError(response);
	}
};

export const getOrganizationId = async (req: Request, res: Response): Promise<void> => {
	try {
		// const organizationId = await Organization.getOrganizationId(req, res);
		// res.status(200).json({ organizationId });
	} catch (error) {
		console.error("Error in getOrganizationId:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getTopPerformance = async (request: Request<{}, {}, {}, { tenantId: string, count?: string, from?: string, to?: string }>, response: Response): Promise<void> => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const topPerformers = await new Organization(null).getTopPerformance(tenantIdP, request.query as unknown as { count: number, from?: string, to?: string });
		response.send({ topPerformers });
	} catch (error) {
		responseError(response);
	}
};

export const generateMonthlySalesReport = async (req: Request<{}, {}, {}, { tenantId: string, organizationid: string }>, res: Response): Promise<void> => {
	try {
		let { organizationid } = req.query;
		if (!organizationid) return customError("Organization id required", 404, res);
		const orgid = parseInt(organizationid.toString())
		const tenantIdP = parseInt(req.query.tenantId.toString())
		const report = await new Organization(orgid).generateOrganizationalSalesReport(tenantIdP);
		res.status(200).json({ status: "success", statusCode: 200, result: report });
	} catch (error) {
		console.error("Error in generateMonthlySalesReport:", error);
		customError("Something went wrong", 500, res);
	}
};



export const createOrganizationPricingHandler = async (request: Request<{}, {}, { organizationid: string | number }, { tenantId: string, organizationid: string }>, response: Response) => {
	try {
		const responseBody = request.body;
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const organizationalId = parseInt(responseBody.organizationid.toString());
		const result = await new OrganizationalBilling(organizationalId).createOrganizationalPricing(tenantIdP, responseBody as any);
		return typeof result === "string" ? response.send({ status: false, message: result }) :
			response.send({ status: result })
	} catch (err) {
		responseError(response);
	}
}

export const getOrganizationPricingHandler = async (request: Request<{}, {}, {}, { tenantId: string, organizationid: string }>, response: Response) => {
	try {
		const organizationid = request.query.organizationid;
		if (!organizationid) return customError("organizational id missing in query", 400, response);
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const result = await new OrganizationalBilling(parseInt(organizationid.toString())).getOrganizationalBilling(tenantIdP);
		response.send(result)
	} catch (err) {
		responseError(response);
	}
}

export const bulkInsertOrganizationsHandler = async (req: Request<{}, {}, { data: Object }, { tenantId: string }>, res: Response) => {
	try {
		const tenantId = parseFloat(req.query.tenantId as string);
		const organizations = req.body.data;
		if (!Array.isArray(organizations) || organizations.length === 0) {
			return res.status(400).json({ success: false, message: "No organizations provided" });
		}
		const orgClass = new Organization(null);
		const results = await orgClass.insertOrganizationsBulk(tenantId, organizations);
		const successCount = results.filter(r => typeof r === 'number').length;
		const failCount = results.length - successCount;
		return res.status(200).json({
			success: failCount === 0,
			partialSuccess: failCount > 0 && successCount > 0,
			total: results.length,
			successCount,
			failCount,
			results
		});
	} catch (error: { message?: string } | any) {
		return res.status(500).json({ success: false, message: "Bulk insert failed", error: error?.message || error });
	}
};

import { IRequest, IResponse } from "./interfaces";
import Organization from "../../models/organization/organization";
import { OperationsStatus } from "../../models/organization/OrgaInterfac";
import { getUploadedImages } from "./uploadImages";
import OrganizationalBilling from "../../models/organization/organizationBilling";
import { HTTPSTATUSERRORS } from "../../Errors/HTTPErrors";
import { customError, responseError } from "../../hooks/helper";


export const getOrganizations = async (req: IRequest, res: IResponse): Promise<void> => {
	try {
		const tenantIdP = parseInt(req.query.tenantId.toString())
		const organizations = await new Organization(null).getOrganizations(tenantIdP);
		res.status(200).json({ organizations });
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getOrganizationsBasic = async (request: IRequest, response: IResponse): Promise<void> => {
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

export const getOrganizationsContact = async (req: IRequest, res: IResponse): Promise<void> => {
	try {
		const tenantIdP = parseInt(req.query.tenantId.toString())
		const organizationsContact = await new Organization(parseInt(req.query.id.toString())).getOrganizationContact(tenantIdP);
		res.send(organizationsContact);
	} catch (error) {
		console.error("Error in getOrganizationsContact:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getOrganizationsPayment = async (request: IRequest, response: IResponse): Promise<void> => {
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

export const deleteOrganization = async (request: IRequest, response: IResponse): Promise<void> => {
	try {
		const { organizationid, employeeid, isPasswordConfirmed } = request.query;
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const deletionStatus = await new Organization(parseInt(organizationid.toString())).deleteOrganization(tenantIdP, parseInt(employeeid.toString()), isPasswordConfirmed as any)
		response.send({ status: deletionStatus });
	} catch (error) {
		console.error("Error in deleteOrganization:", error);
		responseError(response);
	}
};

export const getOrganizationWithDetails = async (request: IRequest, response: IResponse): Promise<void> => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const organizationDetails = await new Organization(null).getOrganizationWithDetails(tenantIdP, request.query);
		response.send({ statusCode: 200, result: organizationDetails, status: "success" })
	} catch (error) {
		response.send({ error: "Internal server error" });
	}
};



export const uploadOrganizationProfilePicture = async (request: IRequest, response: IResponse): Promise<void> => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		response.send({ status: HTTPSTATUSERRORS.HTTP_501_NOT_IMPLEMENTED })
	} catch (err) {
		console.log(err)
	}
}


export const getOrganizationImage = async (request: IRequest, response: IResponse) => {
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

export const createAOrganization = async (request: IRequest, response: IResponse) => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const isCreatedSuccess = await new Organization(null).createAorganization(tenantIdP, request.body);
		if (isCreatedSuccess === OperationsStatus.exist) {
			return response.send({ message: OperationsStatus.exist, status: 'exist' })
		}
		response.send({ message: isCreatedSuccess === true ? "Organization created successfully" : "creating a new organization failed", status: 'created' });
	} catch (error) {
		response.status(500).json({ error: "Internal server error" });
	}
};

export const updateOrganizationBasic = async (request: IRequest, response: IResponse): Promise<void> => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const isUpdated = await new Organization(null).updateOrganizationBasic(tenantIdP, request.body);
		response.status(200).json({ message: isUpdated ? "Organization basic information updated successfully" : "resource update failed" });
	} catch (error) {
		response.status(500).json({ error: "Internal server error" });
	}
};

export const updateOrganizationContact = async (request: IRequest, response: IResponse): Promise<void> => {
	try {
		const { organizationid } = request.body;
		if (!organizationid) return customError('Invalid request body provided', 400, response);
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const isResourcesUpdated = await new Organization(organizationid).updateOrganizationalContactInfo(tenantIdP, request.body);
		response.send({ status: isResourcesUpdated, message: isResourcesUpdated ? "Organization contact information updated successfully" : "Organization contact information update failed" });
	} catch (error) {
		response.status(500).json({ error: "Internal server error" });
	}
};

export const updateOrganizationPayment = async (request: IRequest, response: IResponse): Promise<void> => {
	try {
		const { id } = request.body;
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const is_field_updated = await new Organization(id).updateOrganizationPayment(tenantIdP, request.body);
		response.send({ status: is_field_updated })
	} catch (error) {
		response.status(500).json({ error: "Internal server error" });
	}
};

export const upload = async (req: IRequest, res: IResponse): Promise<void> => {
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

export const dailyOrganizationCommission = async (request: IRequest, response: IResponse): Promise<void> => {
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

export const getOrganizationCommissionByMonth = async (request: IRequest, response: IResponse): Promise<void> => {
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

export const getOrganizationId = async (req: IRequest, res: IResponse): Promise<void> => {
	try {
		// const organizationId = await Organization.getOrganizationId(req, res);
		// res.status(200).json({ organizationId });
	} catch (error) {
		console.error("Error in getOrganizationId:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getTopPerformance = async (request: IRequest, response: IResponse): Promise<void> => {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const topPerformers = await new Organization(null).getTopPerformance(tenantIdP, request.query)
		response.send({ topPerformers });
	} catch (error) {
		responseError(response);
	}
};

export const generateMonthlySalesReport = async (req: IRequest, res: IResponse): Promise<void> => {
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



export const createOrganizationPricingHandler = async (request: IRequest, response: IResponse) => {
	try {
		const responseBody = request.body;
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const organizationalId = responseBody.organizationid;
		const result = await new OrganizationalBilling(organizationalId).createOrganizationalPricing(tenantIdP, responseBody);
		return typeof result === "string" ? response.send({ status: false, message: result }) :
			response.send({ status: result })
	} catch (err) {
		responseError(response);
	}
}

export const getOrganizationPricingHandler = async (request: IRequest, response: IResponse) => {
	try {
		const organizationid = request.query.organizationid;
		if (!organizationid) return customError("organizational id missing in query", 400, response);
		const tenantIdP = parseInt(request.query.tenantId.toString())
		const result = await new OrganizationalBilling(parseInt(organizationid.toString())).getOrganizationalBilling(tenantIdP);
		response.send(result)
	} catch (err) {
		console.log(err)
		responseError(response);
	}
} 

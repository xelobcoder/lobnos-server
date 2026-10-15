import OutsourcedCases from '../../models/organization/outsourcingOrganization/outsourcedCases';


import { Response, Request } from "express";
import Outsourcing from "../../models/organization/outsourcingOrganization/outsourcing";
import { customError, responseError } from "../../hooks/helper";
import { OperationsFailures } from "../../models/operations/types";

const getTenantId = (request: Request): number => {
    const tenantIdValue = request?.query?.tenantId;

    if (tenantIdValue === undefined || tenantIdValue === null || tenantIdValue === '') {
        throw new Error('tenantId is required');
    }

    const tenantId = parseInt(tenantIdValue.toString(), 10);

    if (Number.isNaN(tenantId)) {
        throw new Error('tenantId must be a valid number');
    }

    return tenantId;
};

export const createOrganizationOutSource = async function (request: Request, response: Response) {
    try {
        const { contactNumber, name } = request.body
        if (!contactNumber || !name || isNaN(contactNumber)) {
            return customError('Invalid request provided', 400, response);
        }
        const tenantId = getTenantId(request);
        const isCreated = await new Outsourcing(name, contactNumber).createOutSourceOrganization(tenantId, request.body);
        response.send({ status: isCreated });
    } catch (err) {
        responseError(response);
    }
}

export const updateOrganizationOutSource = async function (request: Request, response: Response) {
    try {
        const { outsourceid } = request.body
        if (!outsourceid) {
            return customError('Invalid outsourceid request provided', 400, response);
        }
        const tenantId = getTenantId(request);
        const isUpdated = await
            new Outsourcing("", 0).updateOutsourceOrganization(tenantId, request.body);
        response.send({ status: isUpdated });
    } catch (err) {
        responseError(response);
    }
}


export const updateOrganizationOutSourceServices = async function (request: Request, response: Response) {
    try {
        const { outsourceid } = request.body
        if (!outsourceid) {
            return customError('Invalid outsourceid request provided', 400, response);
        }
        const tenantId = getTenantId(request);
        const isUpdated = await new Outsourcing("", 0).loadoutsourceOrganizationServices(tenantId, request.body);
        response.send({ status: isUpdated });
    } catch (err) {
        responseError(response);
    }
}


export const getOrganizationOutSourceServices = async function (request: Request, response: Response) {
    try {
        const { outsourceid } = request.query;
        if (!outsourceid) {
            return customError('Invalid outsourceid request provided', 400, response);
        }
        const tenantId = getTenantId(request);
        const data = await new Outsourcing("", 0).getOrganizationOursourcePricing(tenantId, parseInt(outsourceid.toString()));
        response.send(data);
    } catch (err) {
        responseError(response);
    }

}


export const getOrganizationOutSourceBasic = async function (request: Request, response: Response) {
    try {
        const { outsourceid } = request.query;
        if (!outsourceid) {
            return customError('Invalid outsourceid request provided', 400, response);
        }
        const tenantId = getTenantId(request);
        const data = await new Outsourcing("", 0).getOrganizationBasicInformation(tenantId, parseInt(outsourceid.toString()));
        response.send(data);
    } catch (err) {
        responseError(response);
    }

}


export const getOrganizationOutsourcingAll = async function (request: Request, response: Response) {
    try {
        const tenantId = getTenantId(request);
        const data = await new Outsourcing("", 0).getAllOutsourcingOrganization(tenantId, request.query as any);
        response.send(data);
    } catch (err) {
        responseError(response);
    }

}


export const checkIsServiceRenderedByOutsourceOrganization = async function (request: Request<{},{},{},{testid:number, outsourceid:number}>, response: Response) {
    try {
        const { testid, outsourceid } = request.query;
        const parsedTestid = parseInt(testid.toString());
        const parsedOutsourceid = parseInt(outsourceid.toString())
        if (!parsedTestid || !parsedOutsourceid) {
            return customError('Invalid request provided', 400, response);
        }
        const tenantId = getTenantId(request as any);
        const data = await new Outsourcing("", 0).checkOrganizationProvideServicesForATest(tenantId, parsedTestid, parsedOutsourceid);
        const isAvailable = data.length > 0;
        response.send({ isProvideTest: isAvailable })
    } catch (err) {
        responseError(response);
    }
}


export const updateTestPanelOutsourcingInformation = async function (request: Request, response: Response) {
    try {
        const { organizations, testid } = request.body;
        if (!organizations || !testid || !Array.isArray(organizations)) {
            return customError('Invalid request provided', 400, response);
        }
        const tenantId = getTenantId(request);
        const status = await new Outsourcing("", 0).updateTestOutSourcingOrganization(tenantId, organizations, testid);
        response.send({ status })
    } catch (err) {
        responseError(response);
    }
}


export const getTestOutSourcingOrganizations = async function (request: Request, response: Response) {
    try {
        const { testid } = request.query;
        if (!testid) {
            return customError('Invalid request provided', 400, response);
        }
        const parsedTestid = parseInt(testid.toString());
        if (Number.isNaN(parsedTestid)) {
            return customError('Invalid request provided', 400, response);
        }
        const tenantId = getTenantId(request);
        const organization = await new Outsourcing("", 0).getTestOutSourcingOrganizations(tenantId, parsedTestid);
        response.send(organization);
    } catch (err) {
        responseError(response);
    }
}


export const getOutsourcedTestBasedStageHandler = async function (request: Request<{ stage: "unresolved" | "resolved" }, {}, {}, { count: number, page: number, tenantId: string }>, response: Response) {
    try {
        const { count, page } = request.query;
        const stage = request.params.stage

        if (["unresolved", "resolved"].includes(stage) == false) {
            return customError(OperationsFailures.invalidResponseBodyParams, 400, response);
        }
        const tenantId = getTenantId(request as any);
        const result = await Outsourcing.getOutsourcedTestBasedOnstage(tenantId, stage, page, count);
        response.send(result);
    }
    catch (err) {
        console.log(err);
        responseError(response)
    }
}




export const updateToResolveOutsourcedHandler = async function (request: Request<{}, {}, { serviceid: number, employeeid: number }>, response: Response) {
    try {
        const { serviceid, employeeid } = request.body

        if (!serviceid || !employeeid || typeof serviceid != "number" || typeof employeeid != "number") {
            return response.send({ status: false, message: OperationsFailures.invalidResponseBodyParams })
        }
        const tenantId = getTenantId(request);
        const status = await Outsourcing.updateToResolveOutsourced(tenantId, serviceid, employeeid);
        response.send({ status })
    } catch (err) {
        responseError(response);
    }
}

export const getOutsourcedCasesPaginated = async (request: Request<{}, {}, {}, { tenantId: string, count?: string, page?: string, orderby?: 'ASC' | 'DESC' }>, response: Response) => {
    try {
        const tenantId = getTenantId(request);
        const count = parseInt(request.query.count as string) || 20;
        const page = parseInt(request.query.page as string) || 1;
        const orderby = (request.query.orderby as 'ASC' | 'DESC') || 'DESC';
        const result = await OutsourcedCases.getOutsourcedCases(tenantId, { count, page, orderby });
        response.send({ status: 'success', data: result });
    } catch (err) {
        responseError(response);
    }
};
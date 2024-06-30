import { IRequest, IResponse } from "../interfaces";
import Organization from "../models/organization";
import { customError } from "../../../helper";

export const getOrganizations = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const organizations = await Organization.getOrganizations(req, res);
    res.status(200).json({ organizations });
  } catch (error) {
    console.error("Error in getOrganizations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrganizationsBasic = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const organizationsBasic = await Organization.getOrganizationsBasic(req, res);
    res.status(200).json({ organizationsBasic });
  } catch (error) {
    console.error("Error in getOrganizationsBasic:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrganizationsContact = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const organizationsContact = await Organization.getOrganizationsContact(req, res);
    res.status(200).json({ organizationsContact });
  } catch (error) {
    console.error("Error in getOrganizationsContact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrganizationsPayment = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const organizationsPayment = await Organization.getOrganizationsPayment(req, res);
    res.status(200).json({ organizationsPayment });
  } catch (error) {
    console.error("Error in getOrganizationsPayment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteOrganization = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    await Organization.deleteOrganization(req, res);
    res.status(200).json({ message: "Organization deleted successfully" });
  } catch (error) {
    console.error("Error in deleteOrganization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrganizationWithDetails = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const organizationDetails = await Organization.getOrganizationWithDetails(req, res);
    res.status(200).json({ organizationDetails });
  } catch (error) {
    console.error("Error in getOrganizationWithDetails:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createAOrganization = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    await Organization.createAOrganization(req, res);
    res.status(200).json({ message: "Organization created successfully" });
  } catch (error) {
    console.error("Error in createAOrganization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateOrganizationBasic = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    await Organization.updateOrganizationBasic(req, res);
    res.status(200).json({ message: "Organization basic information updated successfully" });
  } catch (error) {
    console.error("Error in updateOrganizationBasic:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateOrganizationContact = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    await Organization.updateOrganizationContact(req, res);
    res.status(200).json({ message: "Organization contact information updated successfully" });
  } catch (error) {
    console.error("Error in updateOrganizationContact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateOrganizationPayment = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    await Organization.updateOrganizationPayment(req, res);
    res.status(200).json({ message: "Organization payment information updated successfully" });
  } catch (error) {
    console.error("Error in updateOrganizationPayment:", error);
    res.status(500).json({ error: "Internal server error" });
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
    console.error("Error in upload:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const dailyOrganizationCommission = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const commission = await Organization.dailyOrganizationCommission(req, res);
    res.status(200).json({ commission });
  } catch (error) {
    console.error("Error in dailyOrganizationCommission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrganizationCommissionByMonth = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const commissionByMonth = await Organization.getOrganizationCommissionByMonth(req, res);
    res.status(200).json({ commissionByMonth });
  } catch (error) {
    console.error("Error in getOrganizationCommissionByMonth:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrganizationId = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const organizationId = await Organization.getOrganizationId(req, res);
    res.status(200).json({ organizationId });
  } catch (error) {
    console.error("Error in getOrganizationId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getTopPerformance = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const topPerformers = await Organization.getTopPerformance(req, res);
    res.status(200).json({ topPerformers });
  } catch (error) {
    console.error("Error in getTopPerformance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const generateMonthlySalesReport = async (req: IRequest, res: IResponse): Promise<void> => {
  try {
    const { organizationid } = req.query;
    if (!organizationid) {
      return customError("Organization id required", 404, res);
    }
    const report = await new Organization(organizationid).generateSalesReport();
    res.status(200).json({ status: "success", statusCode: 200, result: report });
  } catch (error) {
    console.error("Error in generateMonthlySalesReport:", error);
    customError("Something went wrong", 500, res);
  }
};

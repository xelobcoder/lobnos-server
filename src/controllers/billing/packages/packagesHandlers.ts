import { Request, Response } from 'express';
import { Packages } from '../../../models/billing/packages/Billlingpackages';
import { OperationsFailures } from '../../../models/operations/types';
import { responseError } from '../../../hooks/helper';

interface ClinicianPackageRequest {
     clinician_id: number;
     package_id: number;
     assigned_at?: string;
     created_by: number;
}

interface OrganizationPackageRequest {
     organization_id: number;
     package_id: number;
     assigned_at?: string;
}

interface PackageTestRequest {
     package_id: number;
     test_id: number;
     concession_mode: string;
     concession_value?: number;
}

export const createClinicianPackageHandler = async (req: Request<{}, {}, ClinicianPackageRequest[]>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.createClinicianPackage(tenantId, req.body);
          if (Array.isArray(result)) {
               if (result.length === 0) {
                    res.status(200).json({ message: 'No new records to insert. All provided packages already exist.', status: true });
               } else {
                    res.status(201).json({ message: `${result.length} clinician package(s) successfully created.`, ids: result, status: true });
               }
          } else if (typeof result === "string") {
               res.status(400).json({ message: result, status: false });
          } else {
               res.status(500).json({ message: 'An unexpected error occurred while creating clinician packages.', status: false });
          }
     } catch (error: any) {
          res.status(500).json({ message: error.message, status: false });
     }
};

export const getClinicianPackagesHandler = async (req: Request<{ id?: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.getPackagesApplicableClinicians(tenantId, req.params.id ? Number(req.params.id) : null);
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const updateClinicianPackageHandler = async (req: Request<{ id: string }, {}, Partial<ClinicianPackageRequest>>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.updateClinicianPackage(tenantId, Number(req.params.id), req.body);
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const deleteClinicianPackageHandler = async (req: Request<{ id: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.deleteClinicianPackage(tenantId, Number(req.params.id));
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const createOrganizationPackageHandler = async (req: Request<{}, {}, OrganizationPackageRequest[]>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.createOrganizationPackage(tenantId, req.body);
          return res.status(201).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const getOrganizationPackagesHandler = async (req: Request<{ id?: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.getOrganizationPackages(tenantId, req.params.id ? Number(req.params.id) : null);
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const updateOrganizationPackageHandler = async (req: Request<{ id: string }, {}, Partial<OrganizationPackageRequest[]>>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.updateOrganizationPackage(tenantId, Number(req.params.id), req.body);
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const deleteOrganizationPackageHandler = async (req: Request<{ id: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.deleteOrganizationPackage(tenantId, Number(req.params.id));
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const createPackageHandler = async (req: Request<{}, {}>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.createPackage(tenantId, req.body);
          res.status(201).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const getPackagesHandler = async (req: Request<{ id?: string, page?: string, count?: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const page = req.params.page ? Number(req.params.page) : 1;
          const count = req.params.count ? Number(req.params.count) : 10;
          const result = await Packages.getPackagesWithPagination(tenantId, { page, limit: count });
          res.status(200).json(result?.data || []);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const updatePackageHandler = async (req: Request<{ id: string }, {}>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.updatePackage(tenantId, Number(req.params.id), req.body);
          res.status(200).json({status: result > 0});
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const deletePackageHandler = async (req: Request<{ id: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.deletePackage(tenantId, Number(req.params.id));
          res.status(200).json({status: result > 0, message: result > 0 ? "Package deleted successfully" : "Package not found"});
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const createPackageTestHandler = async (req: Request<{}, {}, PackageTestRequest[]>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.createPackageTest(tenantId, req.body);
          if (result && typeof result === "number") {
               return res.status(201).json({ status: "success", message: "Package test created successfully", data: result });
          } else {
               return res.status(400).json({ status: "error", message: "Failed to create package test" });
          }
     } catch (error: any) {
          res.status(500).json({ status: "error", message: error.message });
     }
};

export const getPackageTestsHandler = async (req: Request<{ id?: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.getPackageTests(tenantId, req.params.id ? Number(req.params.id) : null);
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const updatePackageTestHandler = async (req: Request<{ id: string }, {}, Partial<PackageTestRequest>>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.updatePackageTest(tenantId, Number(req.params.id), req.body);
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const deletePackageTestHandler = async (req: Request<{ id: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const result = await Packages.deletePackageTest(tenantId, Number(req.params.id));
          res.status(200).json(result);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

interface PackageVerificationType {
     billingSource: number;
     organizationId: number;
     clinicianId: number;
}

export const verifyAndLoadPackagesHandler = async (request: Request<{}, {}, PackageVerificationType>, response: Response) => {
     try {
          const tenantId: number = parseInt(request.query.tenantId as string, 10);
          const { clinicianId, organizationId, billingSource } = request.body;
          if (billingSource == 6 && clinicianId) {
               const packages = await Packages.getClinicianPackages(tenantId, clinicianId);
               return response.send(packages);
          }
          if (billingSource == 2 && organizationId) {
               const packages = await Packages.getOrganizationPackagesByOrganizationId(tenantId, organizationId);
               return response.send(packages);
          }
          if (billingSource === 1) {
               const packages = await Packages.getPackages(tenantId);
               return response.send(packages);
          }
          response.send([]);
     } catch (err: any) {
          console.log(err)
          responseError(response, err);
     }
};

export const removeClinicianPackageByIdsHandler = async (req: Request<{ clinicianId: string, packageId: string }>, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const clinicianId = Number(req.params.clinicianId);
          const packageId = Number(req.params.packageId);
          
          const result = await Packages.removeClinicianPackageByIds(tenantId, clinicianId, packageId);
          
          if (result > 0) {
               res.status(200).json({ 
                    message: 'Clinician package removed successfully', 
                    status: true,
                    deletedCount: result 
               });
          } else {
               res.status(404).json({ 
                    message: 'Clinician package not found', 
                    status: false 
               });
          }
     } catch (error: any) {
          res.status(500).json({ 
               message: error.message, 
               status: false 
          });
     }
};

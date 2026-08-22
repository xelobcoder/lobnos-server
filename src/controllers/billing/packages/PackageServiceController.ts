import { Request, Response } from 'express';
import { createPackageService } from '../../../models/billing/packages';
import { responseError } from '../../../hooks/helper';
import { ClinicianPackage, OrganizationPackage, Package, PackageTest } from '../../../models/billing/entities/Package.entities';

const packageService = createPackageService();

// Clinician Package Handlers
export const createClinicianPackageHandler = async (req: Request<{}, {}, ClinicianPackage[]>, res: Response) => {
    try {
        const tenantId: number = parseInt(req.query.tenantId as string, 10);
        const result = await packageService.assignPackagesToClinician(tenantId, req.body);
        if (result.length === 0) {
            res.status(200).json({ message: 'No new records to insert. All provided packages already exist.', status: true });
        } else {
            res.status(201).json({ message: `${result.length} clinician package(s) successfully created.`, ids: result, status: true });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message, status: false });
    }
};

export const getClinicianPackagesHandler = async (req: Request<{ id?: string }>, res: Response) => {
    try {
        const tenantId: number = parseInt(req.query.tenantId as string, 10);
        const result = await packageService.getClinicianPackages(tenantId, Number(req.params.id));
        res.status(200).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Organization Package Handlers
export const createOrganizationPackageHandler = async (req: Request<{}, {}, OrganizationPackage[]>, res: Response) => {
    try {
        const tenantId: number = parseInt(req.query.tenantId as string, 10);
        const result = await packageService.assignPackagesToOrganization(tenantId, req.body);
        return res.status(201).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getOrganizationPackagesHandler = async (req: Request<{ id?: string }>, res: Response) => {
    try {
        const tenantId: number = parseInt(req.query.tenantId as string, 10);
        const result = await packageService.getOrganizationPackages(tenantId, req.params.id ? Number(req.params.id) : undefined);
        res.status(200).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Package Handlers
export const createPackageHandler = async (req: Request<{}, {}, Package>, res: Response) => {
    try {
        const tenantId: number = parseInt(req.query.tenantId as string, 10);
        const result = await packageService.createPackage(tenantId, req.body);
        res.status(201).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getPackagesHandler = async (req: Request<{ id?: string, page?: string, count?: string }>, res: Response) => {
    try {
        const tenantId: number = parseInt(req.query.tenantId as string, 10);
        if (req.params.id) {
            const result = await packageService.getPackage(tenantId, Number(req.params.id));
            res.status(200).json(result);
        } else {
            const result = await packageService.getAllPackages(tenantId);
            res.status(200).json(result);
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Package Test Handlers
export const createPackageTestHandler = async (req: Request<{}, {}, PackageTest[]>, res: Response) => {
    try {
        const tenantId: number = parseInt(req.query.tenantId as string, 10);
        const result = await packageService.assignTestsToPackage(tenantId, req.body);
        if (result) {
            return res.status(201).json({
                status: "success",
                message: "Package test created successfully",
                data: result
            });
        }
        return res.status(400).json({ status: "error", message: "Failed to create package test" });
    } catch (error: any) {
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Verification Handler
interface PackageVerificationType {
    billingSource: number;
    organizationId: number;
    clinicianId: number;
}

export const verifyAndLoadPackagesHandler = async (request: Request<{}, {}, PackageVerificationType>, response: Response) => {
    try {
        const tenantId: number = parseInt(request.query.tenantId as string, 10);
        const { clinicianId, organizationId, billingSource } = request.body;

        let packages: Array<ClinicianPackage | OrganizationPackage | Package> = [];

        if (billingSource === 6 && clinicianId) {
            packages = await packageService.getClinicianPackages(tenantId, clinicianId);
        } else if (billingSource === 2 && organizationId) {
            packages = await packageService.getOrganizationPackages(tenantId, organizationId);
        } else if (billingSource === 1) {
            packages = await packageService.getAllPackages(tenantId);
        }

        response.send(packages);
    } catch (err: any) {
        responseError(response, err);
    }
};

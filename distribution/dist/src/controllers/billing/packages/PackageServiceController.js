"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAndLoadPackagesHandler = exports.createPackageTestHandler = exports.getPackagesHandler = exports.createPackageHandler = exports.getOrganizationPackagesHandler = exports.createOrganizationPackageHandler = exports.getClinicianPackagesHandler = exports.createClinicianPackageHandler = void 0;
const packages_1 = require("../../../models/billing/packages");
const helper_1 = require("../../../hooks/helper");
const packageService = (0, packages_1.createPackageService)();
// Clinician Package Handlers
const createClinicianPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await packageService.assignPackagesToClinician(tenantId, req.body);
        if (result.length === 0) {
            res.status(200).json({ message: 'No new records to insert. All provided packages already exist.', status: true });
        }
        else {
            res.status(201).json({ message: `${result.length} clinician package(s) successfully created.`, ids: result, status: true });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message, status: false });
    }
};
exports.createClinicianPackageHandler = createClinicianPackageHandler;
const getClinicianPackagesHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await packageService.getClinicianPackages(tenantId, Number(req.params.id));
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getClinicianPackagesHandler = getClinicianPackagesHandler;
// Organization Package Handlers
const createOrganizationPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await packageService.assignPackagesToOrganization(tenantId, req.body);
        return res.status(201).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createOrganizationPackageHandler = createOrganizationPackageHandler;
const getOrganizationPackagesHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await packageService.getOrganizationPackages(tenantId, req.params.id ? Number(req.params.id) : undefined);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getOrganizationPackagesHandler = getOrganizationPackagesHandler;
// Package Handlers
const createPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await packageService.createPackage(tenantId, req.body);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createPackageHandler = createPackageHandler;
const getPackagesHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        if (req.params.id) {
            const result = await packageService.getPackage(tenantId, Number(req.params.id));
            res.status(200).json(result);
        }
        else {
            const result = await packageService.getAllPackages(tenantId);
            res.status(200).json(result);
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPackagesHandler = getPackagesHandler;
// Package Test Handlers
const createPackageTestHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await packageService.assignTestsToPackage(tenantId, req.body);
        if (result) {
            return res.status(201).json({
                status: "success",
                message: "Package test created successfully",
                data: result
            });
        }
        return res.status(400).json({ status: "error", message: "Failed to create package test" });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.createPackageTestHandler = createPackageTestHandler;
const verifyAndLoadPackagesHandler = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId, 10);
        const { clinicianId, organizationId, billingSource } = request.body;
        let packages = [];
        if (billingSource === 6 && clinicianId) {
            packages = await packageService.getClinicianPackages(tenantId, clinicianId);
        }
        else if (billingSource === 2 && organizationId) {
            packages = await packageService.getOrganizationPackages(tenantId, organizationId);
        }
        else if (billingSource === 1) {
            packages = await packageService.getAllPackages(tenantId);
        }
        response.send(packages);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
};
exports.verifyAndLoadPackagesHandler = verifyAndLoadPackagesHandler;

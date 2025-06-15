"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeClinicianPackageByIdsHandler = exports.verifyAndLoadPackagesHandler = exports.deletePackageTestHandler = exports.updatePackageTestHandler = exports.getPackageTestsHandler = exports.createPackageTestHandler = exports.deletePackageHandler = exports.updatePackageHandler = exports.getPackagesHandler = exports.createPackageHandler = exports.deleteOrganizationPackageHandler = exports.updateOrganizationPackageHandler = exports.getOrganizationPackagesHandler = exports.createOrganizationPackageHandler = exports.deleteClinicianPackageHandler = exports.updateClinicianPackageHandler = exports.getClinicianPackagesHandler = exports.createClinicianPackageHandler = void 0;
const Billlingpackages_1 = require("../../../models/billing/packages/Billlingpackages");
const helper_1 = require("../../../hooks/helper");
const createClinicianPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.createClinicianPackage(tenantId, req.body);
        if (Array.isArray(result)) {
            if (result.length === 0) {
                res.status(200).json({ message: 'No new records to insert. All provided packages already exist.', status: true });
            }
            else {
                res.status(201).json({ message: `${result.length} clinician package(s) successfully created.`, ids: result, status: true });
            }
        }
        else if (typeof result === "string") {
            res.status(400).json({ message: result, status: false });
        }
        else {
            res.status(500).json({ message: 'An unexpected error occurred while creating clinician packages.', status: false });
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
        const result = await Billlingpackages_1.Packages.getPackagesApplicableClinicians(tenantId, req.params.id ? Number(req.params.id) : null);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getClinicianPackagesHandler = getClinicianPackagesHandler;
const updateClinicianPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.updateClinicianPackage(tenantId, Number(req.params.id), req.body);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateClinicianPackageHandler = updateClinicianPackageHandler;
const deleteClinicianPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.deleteClinicianPackage(tenantId, Number(req.params.id));
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteClinicianPackageHandler = deleteClinicianPackageHandler;
const createOrganizationPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.createOrganizationPackage(tenantId, req.body);
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
        const result = await Billlingpackages_1.Packages.getOrganizationPackages(tenantId, req.params.id ? Number(req.params.id) : null);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getOrganizationPackagesHandler = getOrganizationPackagesHandler;
const updateOrganizationPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.updateOrganizationPackage(tenantId, Number(req.params.id), req.body);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateOrganizationPackageHandler = updateOrganizationPackageHandler;
const deleteOrganizationPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.deleteOrganizationPackage(tenantId, Number(req.params.id));
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteOrganizationPackageHandler = deleteOrganizationPackageHandler;
const createPackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.createPackage(tenantId, req.body);
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
        const page = req.params.page ? Number(req.params.page) : 1;
        const count = req.params.count ? Number(req.params.count) : 10;
        const result = await Billlingpackages_1.Packages.getPackagesWithPagination(tenantId, { page, limit: count });
        res.status(200).json((result === null || result === void 0 ? void 0 : result.data) || []);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPackagesHandler = getPackagesHandler;
const updatePackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.updatePackage(tenantId, Number(req.params.id), req.body);
        res.status(200).json({ status: result > 0 });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updatePackageHandler = updatePackageHandler;
const deletePackageHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.deletePackage(tenantId, Number(req.params.id));
        res.status(200).json({ status: result > 0, message: result > 0 ? "Package deleted successfully" : "Package not found" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deletePackageHandler = deletePackageHandler;
const createPackageTestHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.createPackageTest(tenantId, req.body);
        if (result && typeof result === "number") {
            return res.status(201).json({ status: "success", message: "Package test created successfully", data: result });
        }
        else {
            return res.status(400).json({ status: "error", message: "Failed to create package test" });
        }
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
exports.createPackageTestHandler = createPackageTestHandler;
const getPackageTestsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.getPackageTests(tenantId, req.params.id ? Number(req.params.id) : null);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPackageTestsHandler = getPackageTestsHandler;
const updatePackageTestHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.updatePackageTest(tenantId, Number(req.params.id), req.body);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updatePackageTestHandler = updatePackageTestHandler;
const deletePackageTestHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const result = await Billlingpackages_1.Packages.deletePackageTest(tenantId, Number(req.params.id));
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deletePackageTestHandler = deletePackageTestHandler;
const verifyAndLoadPackagesHandler = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId, 10);
        const { clinicianId, organizationId, billingSource } = request.body;
        if (billingSource == 6 && clinicianId) {
            const packages = await Billlingpackages_1.Packages.getClinicianPackages(tenantId, clinicianId);
            return response.send(packages);
        }
        if (billingSource == 2 && organizationId) {
            const packages = await Billlingpackages_1.Packages.getOrganizationPackagesByOrganizationId(tenantId, organizationId);
            return response.send(packages);
        }
        if (billingSource === 1) {
            const packages = await Billlingpackages_1.Packages.getPackages(tenantId);
            return response.send(packages);
        }
        response.send([]);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response, err);
    }
};
exports.verifyAndLoadPackagesHandler = verifyAndLoadPackagesHandler;
const removeClinicianPackageByIdsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const clinicianId = Number(req.params.clinicianId);
        const packageId = Number(req.params.packageId);
        const result = await Billlingpackages_1.Packages.removeClinicianPackageByIds(tenantId, clinicianId, packageId);
        if (result > 0) {
            res.status(200).json({
                message: 'Clinician package removed successfully',
                status: true,
                deletedCount: result
            });
        }
        else {
            res.status(404).json({
                message: 'Clinician package not found',
                status: false
            });
        }
    }
    catch (error) {
        res.status(500).json({
            message: error.message,
            status: false
        });
    }
};
exports.removeClinicianPackageByIdsHandler = removeClinicianPackageByIdsHandler;

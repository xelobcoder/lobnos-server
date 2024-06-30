"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlySalesReport = exports.getTopPerformance = exports.getOrganizationId = exports.getOrganizationCommissionByMonth = exports.dailyOrganizationCommission = exports.upload = exports.updateOrganizationPayment = exports.updateOrganizationContact = exports.updateOrganizationBasic = exports.createAOrganization = exports.getOrganizationWithDetails = exports.deleteOrganization = exports.getOrganizationsPayment = exports.getOrganizationsContact = exports.getOrganizationsBasic = exports.getOrganizations = void 0;
const organization_1 = __importDefault(require("../models/organization"));
const helper_1 = require("../../../helper");
const getOrganizations = async (req, res) => {
    try {
        const organizations = await organization_1.default.getOrganizations(req, res);
        res.status(200).json({ organizations });
    }
    catch (error) {
        console.error("Error in getOrganizations:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getOrganizations = getOrganizations;
const getOrganizationsBasic = async (req, res) => {
    try {
        const organizationsBasic = await organization_1.default.getOrganizationsBasic(req, res);
        res.status(200).json({ organizationsBasic });
    }
    catch (error) {
        console.error("Error in getOrganizationsBasic:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getOrganizationsBasic = getOrganizationsBasic;
const getOrganizationsContact = async (req, res) => {
    try {
        const organizationsContact = await organization_1.default.getOrganizationsContact(req, res);
        res.status(200).json({ organizationsContact });
    }
    catch (error) {
        console.error("Error in getOrganizationsContact:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getOrganizationsContact = getOrganizationsContact;
const getOrganizationsPayment = async (req, res) => {
    try {
        const organizationsPayment = await organization_1.default.getOrganizationsPayment(req, res);
        res.status(200).json({ organizationsPayment });
    }
    catch (error) {
        console.error("Error in getOrganizationsPayment:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getOrganizationsPayment = getOrganizationsPayment;
const deleteOrganization = async (req, res) => {
    try {
        await organization_1.default.deleteOrganization(req, res);
        res.status(200).json({ message: "Organization deleted successfully" });
    }
    catch (error) {
        console.error("Error in deleteOrganization:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.deleteOrganization = deleteOrganization;
const getOrganizationWithDetails = async (req, res) => {
    try {
        const organizationDetails = await organization_1.default.getOrganizationWithDetails(req, res);
        res.status(200).json({ organizationDetails });
    }
    catch (error) {
        console.error("Error in getOrganizationWithDetails:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getOrganizationWithDetails = getOrganizationWithDetails;
const createAOrganization = async (req, res) => {
    try {
        await organization_1.default.createAOrganization(req, res);
        res.status(200).json({ message: "Organization created successfully" });
    }
    catch (error) {
        console.error("Error in createAOrganization:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.createAOrganization = createAOrganization;
const updateOrganizationBasic = async (req, res) => {
    try {
        await organization_1.default.updateOrganizationBasic(req, res);
        res.status(200).json({ message: "Organization basic information updated successfully" });
    }
    catch (error) {
        console.error("Error in updateOrganizationBasic:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.updateOrganizationBasic = updateOrganizationBasic;
const updateOrganizationContact = async (req, res) => {
    try {
        await organization_1.default.updateOrganizationContact(req, res);
        res.status(200).json({ message: "Organization contact information updated successfully" });
    }
    catch (error) {
        console.error("Error in updateOrganizationContact:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.updateOrganizationContact = updateOrganizationContact;
const updateOrganizationPayment = async (req, res) => {
    try {
        await organization_1.default.updateOrganizationPayment(req, res);
        res.status(200).json({ message: "Organization payment information updated successfully" });
    }
    catch (error) {
        console.error("Error in updateOrganizationPayment:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.updateOrganizationPayment = updateOrganizationPayment;
const upload = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
        }
        else {
            res.status(200).json({ message: "File uploaded successfully" });
        }
    }
    catch (error) {
        console.error("Error in upload:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.upload = upload;
const dailyOrganizationCommission = async (req, res) => {
    try {
        const commission = await organization_1.default.dailyOrganizationCommission(req, res);
        res.status(200).json({ commission });
    }
    catch (error) {
        console.error("Error in dailyOrganizationCommission:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.dailyOrganizationCommission = dailyOrganizationCommission;
const getOrganizationCommissionByMonth = async (req, res) => {
    try {
        const commissionByMonth = await organization_1.default.getOrganizationCommissionByMonth(req, res);
        res.status(200).json({ commissionByMonth });
    }
    catch (error) {
        console.error("Error in getOrganizationCommissionByMonth:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getOrganizationCommissionByMonth = getOrganizationCommissionByMonth;
const getOrganizationId = async (req, res) => {
    try {
        const organizationId = await organization_1.default.getOrganizationId(req, res);
        res.status(200).json({ organizationId });
    }
    catch (error) {
        console.error("Error in getOrganizationId:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getOrganizationId = getOrganizationId;
const getTopPerformance = async (req, res) => {
    try {
        const topPerformers = await organization_1.default.getTopPerformance(req, res);
        res.status(200).json({ topPerformers });
    }
    catch (error) {
        console.error("Error in getTopPerformance:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getTopPerformance = getTopPerformance;
const generateMonthlySalesReport = async (req, res) => {
    try {
        const { organizationid } = req.query;
        if (!organizationid) {
            return (0, helper_1.customError)("Organization id required", 404, res);
        }
        const report = await new organization_1.default(organizationid).generateSalesReport();
        res.status(200).json({ status: "success", statusCode: 200, result: report });
    }
    catch (error) {
        console.error("Error in generateMonthlySalesReport:", error);
        (0, helper_1.customError)("Something went wrong", 500, res);
    }
};
exports.generateMonthlySalesReport = generateMonthlySalesReport;

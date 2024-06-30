"use strict";
// src/appHandlers.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateResultSettings = exports.getResultSettings = exports.deleteTax = exports.changeTaxStatus = exports.updateTax = exports.getTax = exports.addTax = exports.getRegistrationSettings = exports.updateRegistrationFields = exports.updateEmailPreference = exports.updateGeneralEmailSettings = exports.getGeneralEmailSettings = exports.getEmailPreference = exports.getSmsSettings = exports.updateSmsSettings = exports.updateApplicationSettings = exports.getApplicationSettingsBilling = exports.getApplicationSettings = void 0;
const helper_1 = require("../../../helper");
const settings_1 = __importDefault(require("../../models/application/settings"));
const tax_1 = __importDefault(require("../../models/application/tax"));
const results_1 = __importDefault(require("../../models/application/results"));
const logger_1 = __importDefault(require("../../../logger"));
const appsettings = new settings_1.default();
const tax = new tax_1.default();
const result = new results_1.default();
const getApplicationSettings = (req, res) => {
    appsettings.getApplicationSettings(req, res);
};
exports.getApplicationSettings = getApplicationSettings;
const getApplicationSettingsBilling = (req, res) => {
    appsettings.getApplicationSettingsBilling(req, res);
};
exports.getApplicationSettingsBilling = getApplicationSettingsBilling;
const updateApplicationSettings = (req, res) => {
    appsettings.updateApplicationSettings(req, res);
};
exports.updateApplicationSettings = updateApplicationSettings;
const updateSmsSettings = (req, res) => {
    appsettings.updateSmsSettings(req, res);
};
exports.updateSmsSettings = updateSmsSettings;
const getSmsSettings = (req, res) => {
    appsettings.getSmsSettings(req, res);
};
exports.getSmsSettings = getSmsSettings;
const getEmailPreference = async (req, res) => {
    try {
        const result = await appsettings.getEmailPreference();
        res.send({ message: "success", status: "success", statusCode: 200, result });
    }
    catch (err) {
        (0, helper_1.customError)("something went wrong", 500, res);
    }
};
exports.getEmailPreference = getEmailPreference;
const getGeneralEmailSettings = async (req, res) => {
    try {
        const result = await appsettings.getGeneralEmailSettings();
        res.send({ message: "success", status: "success", statusCode: 200, result });
    }
    catch (err) {
        (0, helper_1.customError)("something went wrong", 500, res);
    }
};
exports.getGeneralEmailSettings = getGeneralEmailSettings;
const updateGeneralEmailSettings = async (req, res) => {
    try {
        const result = await appsettings.updateGeneralEmailSettings(req.body);
        res.send({
            message: (0, helper_1.rowAffected)(result) ? "updated successfully" : "No updates effected",
            status: "success",
            statusCode: 200,
        });
    }
    catch (err) {
        (0, helper_1.customError)("something went wrong", 500, res);
    }
};
exports.updateGeneralEmailSettings = updateGeneralEmailSettings;
const updateEmailPreference = (req, res) => {
    appsettings.updateEmailPreference(req, res);
};
exports.updateEmailPreference = updateEmailPreference;
const updateRegistrationFields = async (req, res) => {
    try {
        const result = await appsettings.updateRegistrationFields(req, res);
        if (result === true) {
            res.send({ message: "fields updated successfully", statusCode: 200, status: "success" });
        }
        else {
            res.send({ message: "fields update failed", statusCode: "error", status: "error" });
        }
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.responseError)(res);
    }
};
exports.updateRegistrationFields = updateRegistrationFields;
const getRegistrationSettings = async (req, res) => {
    try {
        let result = await appsettings.getRegistrationSettings();
        if (result.length > 0) {
            result = result[0]["fields"];
            if (result !== "{}") {
                return res.send(result);
            }
            res.send(result);
        }
        else {
            return res.send({});
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getRegistrationSettings = getRegistrationSettings;
const addTax = (req, res) => {
    tax.addTax(req, res);
};
exports.addTax = addTax;
const getTax = (req, res) => {
    tax.getTax(req, res);
};
exports.getTax = getTax;
const updateTax = (req, res) => {
    tax.updateTax(req, res);
};
exports.updateTax = updateTax;
const changeTaxStatus = (req, res) => {
    tax.changeTaxStatus(req, res);
};
exports.changeTaxStatus = changeTaxStatus;
const deleteTax = (req, res) => {
    tax.deleteTax(req, res);
};
exports.deleteTax = deleteTax;
const getResultSettings = (req, res) => {
    result.getResultSettings(req, res);
};
exports.getResultSettings = getResultSettings;
const updateResultSettings = (req, res) => {
    result.updateResultSettings(req, res);
};
exports.updateResultSettings = updateResultSettings;

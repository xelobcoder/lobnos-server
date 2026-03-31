"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const utility_1 = require("../../hooks/utility");
const RepoPIqueries_1 = require("./RepoPIqueries");
class PatientImageRepository {
    constructor() {
        this.runqueryPromise = helper_1.promisifyQuery;
    }
    async create(tenantId, patientId, imagePath) {
        try {
            const result = await this.runqueryPromise(tenantId, RepoPIqueries_1.q_create_patient_image, [patientId, imagePath]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (error) {
            logger_1.default.error(error);
            throw new Error("Failed to create patient image");
        }
    }
    async findByPatientId(tenantId, patientId) {
        try {
            const result = await this.runqueryPromise(tenantId, RepoPIqueries_1.q_find_patient_image_by_id, [patientId]);
            return result.length > 0 ? result[0].imagepath : null;
        }
        catch (error) {
            logger_1.default.error(error);
            throw new Error("Failed to find patient image");
        }
    }
    async update(tenantId, patientId, imagePath) {
        try {
            const result = await this.runqueryPromise(tenantId, RepoPIqueries_1.q_update_patient_image, [imagePath, patientId]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (error) {
            logger_1.default.error(error);
            throw new Error("Failed to update patient image");
        }
    }
    async delete(tenantId, patientId) {
        try {
            const result = await this.runqueryPromise(tenantId, RepoPIqueries_1.q_delete_patient_image, [patientId]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (error) {
            logger_1.default.error(error);
            throw new Error("Failed to delete patient image");
        }
    }
    async getImage(tenantId, patientId, storagePath, response) {
        try {
            const imagepath = await this.findByPatientId(tenantId, patientId);
            if (imagepath) {
                const filePath = `${storagePath}/${imagepath}`;
                (0, utility_1.sendFileResponse)(filePath, response);
            }
            else {
                response.status(404).send("Image not found");
            }
        }
        catch (error) {
            logger_1.default.error(error);
            throw new Error("Failed to get patient image");
        }
    }
}
exports.default = new PatientImageRepository();

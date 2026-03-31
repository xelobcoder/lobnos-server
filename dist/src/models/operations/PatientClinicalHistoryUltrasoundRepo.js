"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class PatientClinicalHistoryUltrasoundRepository {
    constructor(tenantId) {
        this.tablename = 'patient_clinical_history_ultrasound';
        this.knexConnection = (0, KnexConnections_1.default)(tenantId);
    }
    async createHistory(historyData) {
        const connection = await this.knexConnection;
        const result = await connection(this.tablename)
            .insert(historyData)
            .onConflict('ascensionid')
            .merge()
            .returning('id');
        return Array.isArray(result) && result.length > 0;
    }
    async getHistoryById(id) {
        const connection = await this.knexConnection;
        return await connection(this.tablename)
            .where({ id })
            .first();
    }
    async getHistoryByAscensionId(ascensionid) {
        const connection = await this.knexConnection;
        return await connection(this.tablename)
            .where({ ascensionid })
            .first();
    }
    async updateHistory(id, updateData) {
        const connection = await this.knexConnection;
        return await connection(this.tablename)
            .where({ id })
            .update(updateData);
    }
    async deleteHistory(id) {
        const connection = await this.knexConnection;
        return await connection(this.tablename)
            .where({ id })
            .del();
    }
    async getAllHistories() {
        const connection = await this.knexConnection;
        return await connection(this.tablename)
            .select('*');
    }
    async getHistoriesByAscensionIds(ascensionIds) {
        if (ascensionIds && ascensionIds.length > 0) {
            const connection = await this.knexConnection;
            return await connection(this.tablename)
                .whereIn('ascensionid', ascensionIds);
        }
        return [];
    }
    async upsertHistory(ascensionid, clinical_history) {
        const connection = await this.knexConnection;
        const updatedCount = await connection(this.tablename)
            .where({ ascensionid })
            .update({ clinical_history, updated_at: connection.fn.now() });
        if (updatedCount === 0) {
            const result = await connection(this.tablename)
                .insert({ ascensionid, clinical_history })
                .returning('id');
            return result[0].id;
        }
        return ascensionid;
    }
}
exports.default = PatientClinicalHistoryUltrasoundRepository;

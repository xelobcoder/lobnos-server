"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class InsuranceClass {
    constructor(insuranceId = null) {
        this.insuranceId = insuranceId;
    }
    async create(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection('privateInsurance')
            .insert({
            insuranceName: data.insuranceName,
            insuranceCode: data.insuranceCode,
            insuranceType: data.insuranceType,
            searchCode: data.searchCode,
            network: data.network,
            tags: data.tags,
            mailingAddress: data.mailingAddress,
            city: data.city,
            state: data.state,
            county: data.county,
            zipCode: data.zipCode,
            comments: data.comments
        })
            .returning('id');
        return result[0];
    }
    async read(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        if (this.insuranceId) {
            const result = await connection('privateInsurance')
                .where('id', this.insuranceId)
                .first();
            return result;
        }
        const result = await connection('privateInsurance').select('*');
        return result;
    }
    async getInsuranceById(tenantId, insuranceId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection('privateInsurance')
            .where('id', insuranceId)
            .first();
        return result;
    }
    async checkInsuranceExistence(tenantId, insuranceId) {
        const result = await this.getInsuranceById(tenantId, insuranceId);
        return !!result;
    }
    async getAllInsurances(tenantId, page = 1, pageSize = 10) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection('privateInsurance')
            .select('*')
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        return result;
    }
    async update(tenantId, data) {
        if (!this.insuranceId)
            throw new Error("Insurance ID is required for update");
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection('privateInsurance')
            .where('id', this.insuranceId)
            .update({
            insuranceName: data.insuranceName,
            insuranceCode: data.insuranceCode,
            insuranceType: data.insuranceType,
            searchCode: data.searchCode,
            network: data.network,
            tags: data.tags,
            mailingAddress: data.mailingAddress,
            city: data.city,
            state: data.state,
            county: data.county,
            zipCode: data.zipCode,
            comments: data.comments
        });
        return result;
    }
    async delete(tenantId) {
        if (!this.insuranceId)
            throw new Error("Insurance ID is required for delete");
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection('privateInsurance')
            .where('id', this.insuranceId)
            .del();
        return result;
    }
}
exports.default = InsuranceClass;

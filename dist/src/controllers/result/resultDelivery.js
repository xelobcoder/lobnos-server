"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class ResultDeliveryClass {
    constructor(billingid, tenantId) {
        this.billingid = billingid;
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async getResultDeliveryForTransaction() {
        const connection = await this.connection;
        return await connection('patient_result_delivery_preference').where({ billingid: this.billingid }).first();
    }
    async setResultDeliveryPreference(payload) {
        const connection = await this.connection;
        await connection('patient_result_delivery_preference')
            .insert(Object.assign(Object.assign({}, payload), { created_at: connection.fn.now() }))
            .onConflict(['billingid'])
            .merge(payload);
        return true;
    }
}
exports.default = ResultDeliveryClass;

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
    async getTestResultDeliveryPreference(testid) {
        const connection = await this.connection;
        return await connection('test_result_delivery_preference')
            .where({ billingid: this.billingid, testid })
            .first();
    }
    async getAllTestResultDeliveryPreferences() {
        const connection = await this.connection;
        return await connection('test_result_delivery_preference')
            .where({ billingid: this.billingid })
            .select('*');
    }
    async setTestResultDeliveryPreference(payload) {
        const connection = await this.connection;
        await connection('test_result_delivery_preference')
            .insert(Object.assign(Object.assign({}, payload), { created_at: connection.fn.now(), updated_at: connection.fn.now() }))
            .onConflict(['billingid', 'testid'])
            .merge({
            requested_mode: payload.requested_mode,
            requested_mode_detail: payload.requested_mode_detail,
            updated_by_employeeid: payload.updated_by_employeeid,
            updated_at: connection.fn.now()
        });
        return true;
    }
    async setMultipleTestResultDeliveryPreferences(preferences) {
        const connection = await this.connection;
        const now = connection.fn.now();
        for (const pref of preferences) {
            await connection('patient_result_delivery_preference')
                .insert(Object.assign(Object.assign({}, pref), { created_at: now, updated_at: now }))
                .onConflict(['billingid', 'ascensionid'])
                .merge({
                requested_mode: pref.requested_mode,
                requested_mode_detail: pref.requested_mode_detail,
                updated_by_employeeid: pref.updated_by_employeeid,
                updated_at: now
            });
        }
        return true;
    }
}
exports.default = ResultDeliveryClass;

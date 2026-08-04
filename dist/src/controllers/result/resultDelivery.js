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
    async getAllResultDeliveryPreferencesForTransaction() {
        const connection = await this.connection;
        return await connection('patient_result_delivery_preference')
            .where({ billingid: this.billingid })
            .select('*');
    }
    async setResultDeliveryPreference(payload) {
        const connection = await this.connection;
        await connection('patient_result_delivery_preference')
            .insert(Object.assign(Object.assign({}, payload), { created_at: connection.fn.now() }))
            .onConflict(['billingid'])
            .merge(payload);
        return true;
    }
    async getResultsUndelivered(startDate, endDate, page, count) {
        const connection = await this.connection;
        const query = connection('patient_result_delivery_preference')
            .innerJoin('result_delivery_log', 'patient_result_delivery_preference.ascension', 'result_delivery_log.ascensionid')
            .innerJoin('new_patients', 'patient_result_delivery_preference.patientid', 'new_patients.patientid')
            .where('delivered_at', null)
            .orWhere('delivered_mode', null);
        if (startDate && endDate) {
            query.andWhereBetween('created_at', [startDate, endDate]);
        }
        const totalcountofUndeliveredResults = await query.clone().count('* as total').first();
        const totalcount = (totalcountofUndeliveredResults === null || totalcountofUndeliveredResults === void 0 ? void 0 : totalcountofUndeliveredResults.total) || 0;
        if (page && count) {
            const offset = (page - 1) * count;
            query.offset(offset).limit(count);
        }
        const dataset = await query.select('result_delivery_log.*', 'new_patients.patientid', 'new_patients.firstname', 'new_patients.lastname', 'new_patients.age', 'new_patients.gender', 'new_patients.ageType', 'new_patients.dob', 'new_patients.mobile_number as contact', 'new_patients.fullpatientid', 'new_patients.designation', 'patient_result_delivery_preference.*');
        return { totalcount, dataset };
    }
    async setMultipleTestResultDeliveryPreferences(preferences, trx) {
        try {
            const connection = trx ? await trx : await this.connection;
            const now = connection.fn.now();
            await connection('patient_result_delivery_preference')
                .insert(Object.assign(Object.assign({}, preferences), { created_at: now, updated_at: now }));
            await connection('result_delivery_log')
                .insert({
                ascensionid: preferences.ascension
            });
            return true;
        }
        catch (err) {
            console.log(err);
            if (trx) {
                await trx.rollback();
            }
            throw new Error("Error loading preferences");
        }
    }
    async getResultDeliveryChain() {
        try {
            const handovers = await this.connection('result_handover_log')
                .leftJoin('roles as r_from', 'result_handover_log.from_employeeid', 'r_from.employeeid')
                .leftJoin('roles as r_to', 'result_handover_log.to_employeeid', 'r_to.employeeid')
                .select('result_handover_log.*', 'r_from.username as from_username', 'r_from.role as from_role', 'r_to.username as to_username', 'r_to.role as to_role')
                .where('result_handover_log.billingid', this.billingid)
                .orderBy('result_handover_log.created_at', 'asc');
            const deliveries = await this.connection('result_delivery_log')
                .leftJoin('roles as r_deliver', 'result_delivery_log.delivered_by_employeeid', 'r_deliver.employeeid')
                .select('result_delivery_log.*', 'r_deliver.username as delivered_by_username', 'r_deliver.role as delivered_by_role')
                .where('result_delivery_log.billingid', this.billingid)
                .orderBy('result_delivery_log.delivered_at', 'asc');
            return { status: true, billingid: this.billingid, handovers, deliveries };
        }
        catch (err) {
            console.log(err);
            throw new Error("Error fetching result delivery chain");
        }
    }
}
exports.default = ResultDeliveryClass;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const helper_1 = require("../../hooks/helper");
class VitalSign {
    constructor(patientid) {
        this.patientid = patientid;
        this.currentDate = new Date();
        this.date = this.currentDate.toISOString().split('T')[0];
        this.time = this.currentDate.toTimeString().split(' ')[0];
    }
    valueGreaterThanZero(value) {
        let parsedValue = 0;
        if (typeof value === "string") {
            parsedValue = parseFloat(value.toString());
        }
        if (typeof value === "number")
            parsedValue = value;
        if (isNaN(parsedValue))
            return false;
        return (parsedValue && parsedValue > 0);
    }
    async createNewVitalSignChart(tenantId, formData) {
        const { blood_pressure_lowerLimit, blood_pressure_upperLimit, temperature, pulse, respiration, spo2, patientid, employeeid } = formData;
        const bloodPressure = `${blood_pressure_upperLimit}/${blood_pressure_lowerLimit}`;
        const validValues = this.valueGreaterThanZero(blood_pressure_lowerLimit) &&
            this.valueGreaterThanZero(blood_pressure_upperLimit) &&
            this.valueGreaterThanZero(spo2) &&
            this.valueGreaterThanZero(respiration) &&
            this.valueGreaterThanZero(temperature) &&
            this.valueGreaterThanZero(pulse) &&
            this.valueGreaterThanZero(patientid) &&
            this.valueGreaterThanZero(employeeid);
        if (validValues) {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_createVitalSign, [patientid, bloodPressure, temperature, pulse, respiration, spo2, employeeid]);
            return (0, helper_1.rowAffected)(result);
        }
        return "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */;
    }
    async deleteVitalSignChart(tenantId, vitalSignId) {
        if (this.valueGreaterThanZero(vitalSignId)) {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_deleteVitalSign, [this.patientid, vitalSignId]);
            return (0, helper_1.rowAffected)(result);
        }
        return "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */;
    }
    async updateVitalSignChart(tenantId, vitalSignId, formData) {
        const { blood_pressure_lowerLimit, blood_pressure_upperLimit, temperature, pulse, respiration, spo2, employeeid } = formData;
        const bloodPressure = `${blood_pressure_upperLimit}/${blood_pressure_lowerLimit}`;
        const validValues = this.valueGreaterThanZero(blood_pressure_lowerLimit) &&
            this.valueGreaterThanZero(blood_pressure_upperLimit) &&
            this.valueGreaterThanZero(spo2) && this.valueGreaterThanZero(respiration) && this.valueGreaterThanZero(temperature) && this.valueGreaterThanZero(pulse) && this.valueGreaterThanZero(employeeid);
        if (validValues) {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_updateVitalSign, [this.patientid, bloodPressure, temperature, pulse, respiration, employeeid, vitalSignId]);
            return (0, helper_1.rowAffected)(result);
        }
        return "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */;
    }
    async getPatientVitalSignList(tenantId, count, page, filterFrom, filterTo) {
        if (this.valueGreaterThanZero(count) && this.valueGreaterThanZero(page)) {
            const offset = (page - 1) * count;
            const queryParams = [this.patientid];
            let query = queries_1.q_getPatientVitalSign;
            if (filterFrom && filterFrom instanceof Date && filterTo && filterTo instanceof Date) {
                const formattedFilterFrom = filterFrom.toISOString().split('T')[0];
                const formattedFilterTo = filterTo.toISOString().split('T')[0];
                query += ` AND date BETWEEN ? AND ?`;
                queryParams.push(formattedFilterFrom, formattedFilterTo);
            }
            query += ` LIMIT ? OFFSET ?`;
            queryParams.push(count, offset);
            try {
                const result = await (0, helper_1.promisifyQuery)(tenantId, query, queryParams);
                return result;
            }
            catch (err) {
                console.error('Database query error:', err);
                return "Query execution failed." /* OperationsFailures.queryExecutionFailed */;
            }
        }
        return "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */;
    }
}
exports.default = VitalSign;

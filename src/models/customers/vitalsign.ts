import { vitalScan } from "./types";
import { q_createVitalSign, q_updateVitalSign, q_deleteVitalSign, q_getPatientVitalSign } from "./queries";
import { OperationsFailures } from "../operations/types";
import { promisifyQuery, rowAffected } from "../../hooks/helper";

export default class VitalSign {
    patientid: number;
    sqlConnection: any;
    currentDate: Date;
    time: any;
    date: any
    constructor(patientid: number) {
        this.patientid = patientid;
        this.currentDate = new Date();
        this.date = this.currentDate.toISOString().split('T')[0];
        this.time = this.currentDate.toTimeString().split(' ')[0];
    }

    private valueGreaterThanZero(value: number | string) {
        let parsedValue = 0;
        if (typeof value === "string") {
            parsedValue = parseFloat(value.toString());
        }
        if (typeof value === "number") parsedValue = value;
        if (isNaN(parsedValue)) return false;
        return (parsedValue && parsedValue > 0);
    }

    async createNewVitalSignChart(tenantId: number, formData: vitalScan) {
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
            const result = await promisifyQuery(tenantId, q_createVitalSign, [patientid, bloodPressure, temperature, pulse, respiration, spo2, employeeid]);
            return rowAffected(result);
        }
        return OperationsFailures.invalidResponseBodyParams;
    }

    async deleteVitalSignChart(tenantId: number, vitalSignId: number) {
        if (this.valueGreaterThanZero(vitalSignId)) {
            const result = await promisifyQuery(tenantId, q_deleteVitalSign, [this.patientid, vitalSignId]);
            return rowAffected(result);
        }
        return OperationsFailures.invalidResponseBodyParams;
    }

    async updateVitalSignChart(tenantId: number, vitalSignId: number, formData: vitalScan) {
        const { blood_pressure_lowerLimit, blood_pressure_upperLimit, temperature, pulse, respiration, spo2, employeeid } = formData;
        const bloodPressure = `${blood_pressure_upperLimit}/${blood_pressure_lowerLimit}`;

        const validValues = this.valueGreaterThanZero(blood_pressure_lowerLimit) &&
            this.valueGreaterThanZero(blood_pressure_upperLimit) &&
            this.valueGreaterThanZero(spo2) && this.valueGreaterThanZero(respiration) && this.valueGreaterThanZero(temperature) && this.valueGreaterThanZero(pulse) && this.valueGreaterThanZero(employeeid);

        if (validValues) {
            const result = await promisifyQuery(tenantId, q_updateVitalSign, [this.patientid, bloodPressure, temperature, pulse, respiration, employeeid, vitalSignId]);
            return rowAffected(result);
        }
        return OperationsFailures.invalidResponseBodyParams;
    }
    async getPatientVitalSignList(tenantId: number, count: number, page: number, filterFrom: Date | null, filterTo: Date | null) {
        if (this.valueGreaterThanZero(count) && this.valueGreaterThanZero(page)) {
            const offset = (page - 1) * count;
            const queryParams: any[] = [this.patientid];
            let query = q_getPatientVitalSign;

            if (filterFrom && filterFrom instanceof Date && filterTo && filterTo instanceof Date) {
                const formattedFilterFrom = filterFrom.toISOString().split('T')[0];
                const formattedFilterTo = filterTo.toISOString().split('T')[0];
                query += ` AND date BETWEEN ? AND ?`;
                queryParams.push(formattedFilterFrom, formattedFilterTo);
            }
            query += ` LIMIT ? OFFSET ?`;
            queryParams.push(count, offset);
            try {
                const result = await promisifyQuery(tenantId, query, queryParams);
                return result;
            } catch (err) {
                console.error('Database query error:', err);
                return OperationsFailures.queryExecutionFailed;
            }
        }
        return OperationsFailures.invalidResponseBodyParams;
    }

}

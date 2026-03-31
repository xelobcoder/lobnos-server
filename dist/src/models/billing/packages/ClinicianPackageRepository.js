"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicianPackageRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class ClinicianPackageRepository {
    async createClinicianPackage(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const formattedData = data.map(item => (Object.assign(Object.assign({}, item), { assigned_at: item.assigned_at || connection.fn.now() })));
        const existingRecords = await connection('clinician_packages')
            .whereIn(['clinician_id', 'package_id'], formattedData.map(item => [item.clinician_id, item.package_id]))
            .select('clinician_id', 'package_id');
        const existingSet = new Set(existingRecords.map(record => `${record.clinician_id}-${record.package_id}`));
        const newData = formattedData.filter(item => !existingSet.has(`${item.clinician_id}-${item.package_id}`));
        if (newData.length === 0)
            return [];
        const result = await connection('clinician_packages').insert(newData).returning('id');
        return result.map((row) => row.id);
    }
    async getClinicianPackages(tenantId, clinicianId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('clinician_packages').where({ clinician_id: clinicianId });
    }
    async updateClinicianPackage(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('clinician_packages').where({ id }).update(updates);
    }
    async deleteClinicianPackage(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('clinician_packages').where({ id }).del();
    }
}
exports.ClinicianPackageRepository = ClinicianPackageRepository;

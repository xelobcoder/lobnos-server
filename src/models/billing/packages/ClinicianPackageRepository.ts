import KnexConnection from "../../../database/KnexConnections";
import { PrimeLimsTableclinician_packages } from "../../../database/DatabaseTableSchema";
import { IClinicianPackageRepository } from "./IPackageRepository";

export class ClinicianPackageRepository implements IClinicianPackageRepository {
    async createClinicianPackage(tenantId: number, data: PrimeLimsTableclinician_packages[]): Promise<number[]> {
        const connection = await KnexConnection(tenantId);
        const formattedData = data.map(item => ({
            ...item,
            assigned_at: item.assigned_at || connection.fn.now()
        }));

        const existingRecords = await connection('clinician_packages')
            .whereIn(['clinician_id', 'package_id'], formattedData.map(item => [item.clinician_id, item.package_id]))
            .select('clinician_id', 'package_id');

        const existingSet = new Set(existingRecords.map(record => `${record.clinician_id}-${record.package_id}`));
        const newData = formattedData.filter(item => !existingSet.has(`${item.clinician_id}-${item.package_id}`));

        if (newData.length === 0) return [];
        const result = await connection('clinician_packages').insert(newData).returning('id');
        return result.map((row: { id: number }) => row.id);
    }

    async getClinicianPackages(tenantId: number, clinicianId: number): Promise<PrimeLimsTableclinician_packages[]> {
        const connection = await KnexConnection(tenantId);
        return await connection('clinician_packages').where({ clinician_id: clinicianId });
    }

    async updateClinicianPackage(tenantId: number, id: number, updates: Partial<PrimeLimsTableclinician_packages>): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('clinician_packages').where({ id }).update(updates);
    }

    async deleteClinicianPackage(tenantId: number, id: number): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('clinician_packages').where({ id }).del();
    }
}
import KnexConnection from "../../../database/KnexConnections";
import { PrimeLimsTablepackages } from "../../../database/DatabaseTableSchema";
import { IPackageRepository } from "./IPackageRepository";

export class PackageRepository implements IPackageRepository {
    async createPackage(tenantId: number, data: PrimeLimsTablepackages): Promise<number[]> {
        const connection = await KnexConnection(tenantId);
        return await connection('packages').insert({
            ...data,
            created_at: connection.fn.now(),
            updated_at: connection.fn.now()
        });
    }

    async getPackages(tenantId: number, id?: number): Promise<PrimeLimsTablepackages | PrimeLimsTablepackages[]> {
        const connection = await KnexConnection(tenantId);
        if (id) {
            return await connection('packages').where({ id }).first();
        }
        return await connection('packages').select('*');
    }

    async updatePackage(tenantId: number, id: number, updates: Partial<PrimeLimsTablepackages>): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('packages')
            .where({ id })
            .update({
                ...updates,
                updated_at: connection.fn.now()
            });
    }

    async deletePackage(tenantId: number, id: number): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('packages').where({ id }).del();
    }

    async getPackagesWithPagination(tenantId: number, page: number = 1, count: number = 10): Promise<{ data: PrimeLimsTablepackages[] }> {
        const connection = await KnexConnection(tenantId);
        const offset = (page - 1) * count;
        const data = await connection('packages')
            .join('roles', 'roles.employeeid', '=', 'packages.created_by')
            .select('packages.*', 'roles.username')
            .limit(count)
            .offset(offset);
        return { data };
    }
}
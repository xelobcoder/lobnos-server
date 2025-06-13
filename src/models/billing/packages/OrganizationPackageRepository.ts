import KnexConnection from "../../../database/KnexConnections";
import { PrimeLimsTableorganization_packages } from "../../../database/DatabaseTableSchema";
import { IOrganizationPackageRepository } from "./IPackageRepository";

export class OrganizationPackageRepository implements IOrganizationPackageRepository {
    async createOrganizationPackage(tenantId: number, data: PrimeLimsTableorganization_packages[]): Promise<number[]> {
        const connection = await KnexConnection(tenantId);
        const formattedData = data.map(item => ({
            ...item,
            assigned_at: item.assigned_at || connection.fn.now()
        }));

        const result: number[] = [];
        for (const item of formattedData) {
            const existingPackage = await connection('organization_packages')
                .where('organization_id', item.organization_id)
                .where('package_id', item.package_id)
                .first();

            if (!existingPackage) {
                const [id] = await connection('organization_packages').insert(item);
                result.push(id);
            }
        }
        return result;
    }

    async getOrganizationPackages(tenantId: number, id?: number): Promise<PrimeLimsTableorganization_packages[]> {
        const connection = await KnexConnection(tenantId);
        if (id) {
            return await connection('organization_packages')
                .join('packages', 'packages.id', '=', 'organization_packages.package_id')
                .join('organization', 'organization.id', '=', 'organization_packages.organization_id')
                .where('organization_packages.package_id', id)
                .select('organization_packages.*');
        }
        return await connection('organization_packages')
            .join('packages', 'packages.id', '=', 'organization_packages.package_id')
            .join('organization', 'organization.id', '=', 'organization_packages.organization_id')
            .select('organization_packages.*');
    }

    async updateOrganizationPackage(tenantId: number, id: number, data: PrimeLimsTableorganization_packages[]): Promise<number> {
        const connection = await KnexConnection(tenantId);
        await connection('organization_packages').where({ package_id: id }).del();
        
        const formattedData = data.map(item => ({
            ...item,
            assigned_at: item.assigned_at || connection.fn.now()
        }));

        await connection('organization_packages').insert(formattedData);
        return formattedData.length;
    }

    async deleteOrganizationPackage(tenantId: number, id: number): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('organization_packages').where({ package_id: id }).del();
    }
}
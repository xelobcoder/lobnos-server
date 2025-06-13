import KnexConnection from "../../../database/KnexConnections";
import { PrimeLimsTablepackage_tests } from "../../../database/DatabaseTableSchema";
import { IPackageTestRepository } from "./IPackageRepository";

export class PackageTestRepository implements IPackageTestRepository {
    async createPackageTest(tenantId: number, data: PrimeLimsTablepackage_tests[]): Promise<number> {
        const connection = await KnexConnection(tenantId);
        const result: number[] = [];

        for (const item of data) {
            const existingItem = await connection('package_tests')
                .where('package_id', item.package_id)
                .andWhere('test_id', item.test_id)
                .first();

            if (!existingItem) {
                const [id] = await connection('package_tests').insert(item);
                result.push(id);
            }
        }
        return result.length;
    }

    async getPackageTests(tenantId: number, id?: number): Promise<PrimeLimsTablepackage_tests[]> {
        const connection = await KnexConnection(tenantId);
        try {
            if (id) {
                return await connection('package_tests')
                    .join("test_panels", "test_panels.id", "=", "package_tests.test_id")
                    .join("testdetails", "testdetails.testid", "=", "test_panels.id")
                    .select("package_tests.*")
                    .where({ "package_tests.package_id": id });
            }
            return await connection('package_tests')
                .join("test_panels", "test_panels.id", "=", "package_tests.test_id")
                .join("testdetails", "testdetails.testid", "=", "test_panels.id")
                .select("package_tests.*");
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async updatePackageTest(tenantId: number, id: number, updates: Partial<PrimeLimsTablepackage_tests>): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('package_tests').where({ id }).update(updates);
    }

    async deletePackageTest(tenantId: number, id: number): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('package_tests').where({ id }).del();
    }
}
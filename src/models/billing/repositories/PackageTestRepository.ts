import KnexConnection from "../../../database/KnexConnections";
import { PackageTest } from "../entities/Package.entities";
import { IPackageTestRepository } from "../Interfaces/IPackageRepository";

export class PackageTestRepository implements IPackageTestRepository {
    async createPackageTest(tenantId: number, data: PackageTest[]): Promise<number> {
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

    async getPackageTests(tenantId: number, id?: number): Promise<PackageTest[]> {
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

    async updatePackageTest(tenantId: number, id: number, updates: Partial<PackageTest>): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('package_tests').where({ id }).update(updates);
    }

    async deletePackageTest(tenantId: number, id: number): Promise<number> {
        const connection = await KnexConnection(tenantId);
        return await connection('package_tests').where({ id }).del();
    }
}
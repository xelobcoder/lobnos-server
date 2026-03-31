"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageTestRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class PackageTestRepository {
    async createPackageTest(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = [];
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
    async getPackageTests(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
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
        }
        catch (err) {
            console.error(err);
            throw err;
        }
    }
    async updatePackageTest(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('package_tests').where({ id }).update(updates);
    }
    async deletePackageTest(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('package_tests').where({ id }).del();
    }
}
exports.PackageTestRepository = PackageTestRepository;

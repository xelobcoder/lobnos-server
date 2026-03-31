"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class PackageRepository {
    async createPackage(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('packages').insert(Object.assign(Object.assign({}, data), { created_at: connection.fn.now(), updated_at: connection.fn.now() }));
    }
    async getPackages(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        if (id) {
            return await connection('packages').where({ id }).first();
        }
        return await connection('packages').select('*');
    }
    async updatePackage(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('packages')
            .where({ id })
            .update(Object.assign(Object.assign({}, updates), { updated_at: connection.fn.now() }));
    }
    async deletePackage(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('packages').where({ id }).del();
    }
    async getPackagesWithPagination(tenantId, page = 1, count = 10) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const offset = (page - 1) * count;
        const data = await connection('packages')
            .join('roles', 'roles.employeeid', '=', 'packages.created_by')
            .select('packages.*', 'roles.username')
            .limit(count)
            .offset(offset);
        return { data };
    }
}
exports.PackageRepository = PackageRepository;

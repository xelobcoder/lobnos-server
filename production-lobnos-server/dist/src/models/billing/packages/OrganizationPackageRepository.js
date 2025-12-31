"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationPackageRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class OrganizationPackageRepository {
    async createOrganizationPackage(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const formattedData = data.map(item => (Object.assign(Object.assign({}, item), { assigned_at: item.assigned_at || connection.fn.now() })));
        const result = [];
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
    async getOrganizationPackages(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
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
    async updateOrganizationPackage(tenantId, id, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        await connection('organization_packages').where({ package_id: id }).del();
        const formattedData = data.map(item => (Object.assign(Object.assign({}, item), { assigned_at: item.assigned_at || connection.fn.now() })));
        await connection('organization_packages').insert(formattedData);
        return formattedData.length;
    }
    async deleteOrganizationPackage(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('organization_packages').where({ package_id: id }).del();
    }
}
exports.OrganizationPackageRepository = OrganizationPackageRepository;

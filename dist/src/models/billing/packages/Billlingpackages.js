"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Packages = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class Packages {
    static async createClinicianPackage(tenantId, data) {
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            if (!(data === null || data === void 0 ? void 0 : data.length)) {
                throw new Error('No data provided for clinician packages');
            }
            const clinicianIds = [...new Set(data.map(item => item.clinician_id))];
            const packageId = data[0].package_id;
            const validClinicians = await connection('clinicianbasicinfo')
                .whereIn('id', clinicianIds)
                .select('id');
            if (!validClinicians.length) {
                throw new Error('No valid clinicians found');
            }
            const validClinicianIds = new Set(validClinicians.map(c => c.id));
            const formattedData = data
                .filter(item => validClinicianIds.has(item.clinician_id))
                .map(item => ({
                clinician_id: item.clinician_id,
                package_id: packageId,
                assigned_at: item.assigned_at ? new Date(item.assigned_at).toISOString() : connection.fn.now(),
            }));
            const existingRecords = await connection('clinician_packages')
                .select('id', 'clinician_id', 'package_id')
                .where('package_id', packageId);
            const newClinicianIds = new Set(formattedData.map(item => item.clinician_id));
            const recordsToDelete = existingRecords.filter(record => !newClinicianIds.has(record.clinician_id));
            const existingClinicianIds = new Set(existingRecords.map(record => record.clinician_id));
            const recordsToInsert = formattedData.filter(item => !existingClinicianIds.has(item.clinician_id));
            if (recordsToDelete.length > 0) {
                await connection('clinician_packages')
                    .whereIn('id', recordsToDelete.map(record => record.id))
                    .del();
            }
            if (recordsToInsert.length > 0) {
                const result = await connection('clinician_packages')
                    .insert(recordsToInsert)
                    .returning('id');
                return result.map((row) => row.id);
            }
            if (recordsToDelete.length === 0 && recordsToInsert.length === 0) {
                throw new Error('No new records to insert. All provided clinician packages already exist.');
            }
            if (recordsToDelete.length > 0 && recordsToInsert.length === 0) {
                return `${recordsToDelete.length} clinician package(s) successfully deleted. No new records to insert.`;
            }
            return [];
        }
        catch (error) {
            throw new Error(`Error creating clinician packages: ${error.message}`);
        }
    }
    static async getPackagesApplicableClinicians(tenantId, id = null) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        if (id) {
            return await connection('clinician_packages')
                .join('clinicianbasicinfo', 'clinicianbasicinfo.id', '=', 'clinician_packages.clinician_id')
                .where({ 'clinician_packages.package_id': id })
                .select('clinician_packages.*', 'clinicianbasicinfo.name', 'clinicianbasicinfo.location', 'clinicianbasicinfo.phone');
        }
        return await connection('clinician_packages').select('*');
    }
    static async getPackagesByIds(tenantId, packageIds) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            const packages = await connection('packages')
                .whereIn('id', packageIds)
                .select('*');
            return packages;
        }
        catch (error) {
            console.error('Error fetching packages:', error);
            throw error;
        }
    }
    static async getClinicianPackages(tenantId, clinician_id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        if (clinician_id) {
            const result = await connection('clinician_packages').where({ clinician_id });
            if (result && result.length > 0) {
                const pkgIds = result.map(item => item.package_id);
                return await this.getPackagesByIds(tenantId, pkgIds);
            }
            else {
                return [];
            }
        }
        return [];
    }
    static async getOrganizationPackagesByOrganizationId(tenantId, organization_id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection('organization_packages').where({ organization_id });
        if (result && result.length > 0) {
            const pkgIds = result.map(item => item.package_id);
            return await this.getPackagesByIds(tenantId, pkgIds);
        }
        else {
            return [];
        }
    }
    static async updateClinicianPackage(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('clinician_packages').where({ id }).update(updates);
    }
    static async deleteClinicianPackage(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('clinician_packages').where({ id }).del();
    }
    static async createOrganizationPackage(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const formattedData = data.map(item => ({
            organization_id: item.organization_id,
            package_id: item.package_id,
            assigned_at: item.assigned_at || connection.fn.now(),
        }));
        for (const item of formattedData) {
            const existingPackage = await connection('organization_packages')
                .where('organization_id', item.organization_id)
                .where('package_id', item.package_id)
                .first();
            if (!existingPackage) {
                await connection('organization_packages').insert(item);
            }
        }
        return [];
    }
    static async getOrganizationPackages(tenantId, id = null) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        if (id) {
            return await connection('organization_packages')
                .join('packages', 'packages.id', '=', 'organization_packages.package_id')
                .join('organization', 'organization.id', '=', 'organization_packages.organization_id')
                .where('organization_packages.package_id', id)
                .select('organization_packages.*', 'packages.*', 'organization.*');
        }
        return await connection('organization_packages')
            .join('packages', 'packages.id', '=', 'organization_packages.package_id')
            .join('organization', 'organization.id', '=', 'organization_packages.organization_id')
            .select('organization_packages.*', 'packages.*', 'organization.*');
    }
    static async updateOrganizationPackage(tenantId, id, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const deletedCount = await connection('organization_packages')
            .where({ package_id: id })
            .del();
        if (deletedCount > 0) {
            const formattedData = data.map(item => ({
                organization_id: item.organization_id,
                package_id: item.package_id,
                assigned_at: item.assigned_at || connection.fn.now(),
            }));
            const outcome = await connection('organization_packages').insert(formattedData);
            return outcome;
        }
        return 0;
    }
    static async deleteOrganizationPackage(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('organization_packages').where({ package_id: id }).del();
    }
    static async createPackage(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('packages').insert({
            package_name: data.package_name,
            created_at: connection.fn.now(),
            created_by: data.created_by,
            updated_at: connection.fn.now(),
        });
    }
    static async getPackages(tenantId, id = null) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        if (id) {
            return await connection('packages').where({ id }).first();
        }
        return await connection('packages').select('*');
    }
    static async updatePackage(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('packages')
            .where({ id })
            .update(Object.assign(Object.assign({}, updates), { updated_at: connection.fn.now() }));
    }
    static async deletePackage(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection('packages').where({ id }).del();
    }
    static async createPackageTest(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const formattedData = data.map(item => ({
            package_id: item.package_id,
            test_id: item.test_id,
            concession_mode: item.concession_mode,
            concession_value: item.concession_value || null,
        }));
        const result = [];
        for (const item of formattedData) {
            const existingItem = await connection('package_tests')
                .where('package_id', item.package_id)
                .andWhere('test_id', item.test_id)
                .first();
            if (!existingItem) {
                const insertedIds = await connection('package_tests').insert(item);
                result.push(insertedIds[0]);
            }
        }
        return result.length > 0 ? result.length : 1;
    }
    static async getPackageTests(tenantId, id = null) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        try {
            if (id) {
                return await connection('package_tests')
                    .join("test_panels", "test_panels.id", "=", "package_tests.test_id")
                    .join("testdetails", "testdetails.testid", "=", "test_panels.id")
                    .select("package_tests.*", "test_panels.name as name", "test_panels.price", "testdetails.isoutsourced")
                    .where({ "package_tests.package_id": id });
            }
            return await connection('package_tests')
                .join("test_panels", "test_panels.id", "=", "package_tests.test_id")
                .join("testdetails", "testdetails.testid", "=", "test_panels.id")
                .select("package_tests.*", "test_panels.name as name", "test_panels.price", "testdetails.isoutsourced");
        }
        catch (err) {
            console.log(err);
            throw err;
        }
    }
    static async getPackagesWithPagination(tenantId, { page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'desc' }) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const offset = (page - 1) * limit;
        try {
            const query = connection('packages')
                .select('packages.*', 'roles.username', connection.raw('COUNT(DISTINCT pt.test_id) as test_count'), connection.raw('COUNT(DISTINCT cp.clinician_id) as clinician_count'), connection.raw('COUNT(DISTINCT op.organization_id) as organization_count'))
                .leftJoin('package_tests as pt', 'packages.id', 'pt.package_id')
                .leftJoin('clinician_packages as cp', 'packages.id', 'cp.package_id')
                .leftJoin('organization_packages as op', 'packages.id', 'op.package_id')
                .leftJoin('roles', 'roles.employeeid', 'packages.created_by')
                .groupBy('packages.id');
            if (search) {
                query.where('packages.package_name', 'like', `%${search}%`);
            }
            const [{ count }] = await query.clone().count('packages.id as count');
            const total = parseInt(count);
            const data = await query
                .orderBy(sortBy, sortOrder)
                .limit(limit)
                .offset(offset);
            return {
                data,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };
        }
        catch (error) {
            throw error;
        }
    }
    static async removeClinicianPackageByIds(tenantId, clinicianId, packageId) {
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const result = await connection('clinician_packages')
                .where({
                clinician_id: clinicianId,
                package_id: packageId
            })
                .del();
            return result;
        }
        catch (error) {
            throw new Error(`Error removing clinician package: ${error.message}`);
        }
    }
}
exports.Packages = Packages;

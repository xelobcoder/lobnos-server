"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageService = void 0;
class PackageService {
    constructor(packageRepo, clinicianPackageRepo, organizationPackageRepo, packageTestRepo) {
        this.packageRepo = packageRepo;
        this.clinicianPackageRepo = clinicianPackageRepo;
        this.organizationPackageRepo = organizationPackageRepo;
        this.packageTestRepo = packageTestRepo;
    }
    // Package Management
    async createPackage(tenantId, packageData) {
        return await this.packageRepo.createPackage(tenantId, packageData);
    }
    async getPackage(tenantId, id) {
        const result = await this.packageRepo.getPackages(tenantId, id);
        return result;
    }
    async getAllPackages(tenantId) {
        const result = await this.packageRepo.getPackages(tenantId);
        return result;
    }
    // Clinician Package Management
    async assignPackagesToClinician(tenantId, packages) {
        return await this.clinicianPackageRepo.createClinicianPackage(tenantId, packages);
    }
    async getClinicianPackages(tenantId, clinicianId) {
        return await this.clinicianPackageRepo.getClinicianPackages(tenantId, clinicianId);
    }
    // Organization Package Management
    async assignPackagesToOrganization(tenantId, packages) {
        return await this.organizationPackageRepo.createOrganizationPackage(tenantId, packages);
    }
    async getOrganizationPackages(tenantId, organizationId) {
        return await this.organizationPackageRepo.getOrganizationPackages(tenantId, organizationId);
    }
    // Package Test Management
    async assignTestsToPackage(tenantId, tests) {
        return await this.packageTestRepo.createPackageTest(tenantId, tests);
    }
    async getPackageTests(tenantId, packageId) {
        return await this.packageTestRepo.getPackageTests(tenantId, packageId);
    }
    // Complex Operations
    async createPackageWithTests(tenantId, packageData, tests) {
        const [packageId] = await this.createPackage(tenantId, packageData);
        const testsWithPackageId = tests.map(test => (Object.assign(Object.assign({}, test), { package_id: packageId })));
        const testsCount = await this.assignTestsToPackage(tenantId, testsWithPackageId);
        return { packageId, testsCount };
    }
    async deletePackageWithAssociations(tenantId, packageId) {
        await this.packageTestRepo.deletePackageTest(tenantId, packageId);
        await this.clinicianPackageRepo.deleteClinicianPackage(tenantId, packageId);
        await this.organizationPackageRepo.deleteOrganizationPackage(tenantId, packageId);
        await this.packageRepo.deletePackage(tenantId, packageId);
    }
}
exports.PackageService = PackageService;

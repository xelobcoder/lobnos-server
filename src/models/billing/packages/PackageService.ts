import { ClinicianPackage, OrganizationPackage, Package, PackageAssignment, PackageTest } from "../entities/Package.entities";
import {
    IPackageRepository,
    IPackageAssignmentRepository,
    IPackageTestRepository
} from "../Interfaces/IPackageRepository";

export class PackageService {
    constructor(
        private packageRepo: IPackageRepository,
        private packageAssignmentRepo: IPackageAssignmentRepository,
        private packageTestRepo: IPackageTestRepository
    ) { }

    // Package Management
    async createPackage(tenantId: number, packageData: Package): Promise<number[]> {
        return await this.packageRepo.createPackage(tenantId, packageData);
    }

    async getPackage(tenantId: number, id: number): Promise<Package> {
        const result = await this.packageRepo.getPackages(tenantId, id);
        return result as Package;
    }

    async getAllPackages(tenantId: number): Promise<Package[]> {
        const result = await this.packageRepo.getPackages(tenantId);
        return result as Package[];
    }

    // Clinician Package Management
    async assignPackagesToClinician(tenantId: number, packages: ClinicianPackage[]): Promise<number[]> {
        return await this.packageAssignmentRepo.createAssignments(tenantId, packages.map((item) => ({
            ...item,
            assignment_type: 'clinician' as const,
            organization_id: null,
        })));
    }

    async getClinicianPackages(tenantId: number, clinicianId: number): Promise<ClinicianPackage[]> {
        return await this.packageAssignmentRepo.getAssignments(tenantId, 'clinician', clinicianId) as ClinicianPackage[];
    }

    // Organization Package Management
    async assignPackagesToOrganization(tenantId: number, packages: OrganizationPackage[]): Promise<number[]> {
        return await this.packageAssignmentRepo.createAssignments(tenantId, packages.map((item) => ({
            ...item,
            assignment_type: 'organization' as const,
            clinician_id: null,
        })));
    }

    async getOrganizationPackages(tenantId: number, organizationId?: number): Promise<OrganizationPackage[]> {
        return await this.packageAssignmentRepo.getAssignments(tenantId, 'organization', organizationId) as OrganizationPackage[];
    }

    // Package Test Management
    async assignTestsToPackage(tenantId: number, tests: PackageTest[]): Promise<number> {
        return await this.packageTestRepo.createPackageTest(tenantId, tests);
    }

    async getPackageTests(tenantId: number, packageId?: number): Promise<PackageTest[]> {
        return await this.packageTestRepo.getPackageTests(tenantId, packageId);
    }

    // Complex Operations
    async createPackageWithTests(
        tenantId: number,
        packageData: Package,
        tests: PackageTest[]
    ): Promise<{ packageId: number, testsCount: number }> {
        const [packageId] = await this.createPackage(tenantId, packageData);
        const testsWithPackageId = tests.map(test => ({
            ...test,
            package_id: packageId
        }));
        const testsCount = await this.assignTestsToPackage(tenantId, testsWithPackageId);
        return { packageId, testsCount };
    }

    async deletePackageWithAssociations(tenantId: number, packageId: number): Promise<void> {
        await this.packageTestRepo.deletePackageTest(tenantId, packageId);
        await this.packageAssignmentRepo.deleteAssignmentsForPackage(tenantId, packageId);
        await this.packageRepo.deletePackage(tenantId, packageId);
    }
}
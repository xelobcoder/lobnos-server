import { 
    PrimeLimsTablepackages, 
    PrimeLimsTableclinician_packages, 
    PrimeLimsTableorganization_packages, 
    PrimeLimsTablepackage_tests 
} from "../../../database/DatabaseTableSchema";
import { 
    IPackageRepository, 
    IClinicianPackageRepository, 
    IOrganizationPackageRepository, 
    IPackageTestRepository 
} from "./IPackageRepository";

export class PackageService {
    constructor(
        private packageRepo: IPackageRepository,
        private clinicianPackageRepo: IClinicianPackageRepository,
        private organizationPackageRepo: IOrganizationPackageRepository,
        private packageTestRepo: IPackageTestRepository
    ) {}

    // Package Management
    async createPackage(tenantId: number, packageData: PrimeLimsTablepackages): Promise<number[]> {
        return await this.packageRepo.createPackage(tenantId, packageData);
    }

    async getPackage(tenantId: number, id: number): Promise<PrimeLimsTablepackages> {
        const result = await this.packageRepo.getPackages(tenantId, id);
        return result as PrimeLimsTablepackages;
    }

    async getAllPackages(tenantId: number): Promise<PrimeLimsTablepackages[]> {
        const result = await this.packageRepo.getPackages(tenantId);
        return result as PrimeLimsTablepackages[];
    }

    // Clinician Package Management
    async assignPackagesToClinician(tenantId: number, packages: PrimeLimsTableclinician_packages[]): Promise<number[]> {
        return await this.clinicianPackageRepo.createClinicianPackage(tenantId, packages);
    }

    async getClinicianPackages(tenantId: number, clinicianId: number): Promise<PrimeLimsTableclinician_packages[]> {
        return await this.clinicianPackageRepo.getClinicianPackages(tenantId, clinicianId);
    }

    // Organization Package Management
    async assignPackagesToOrganization(tenantId: number, packages: PrimeLimsTableorganization_packages[]): Promise<number[]> {
        return await this.organizationPackageRepo.createOrganizationPackage(tenantId, packages);
    }

    async getOrganizationPackages(tenantId: number, organizationId?: number): Promise<PrimeLimsTableorganization_packages[]> {
        return await this.organizationPackageRepo.getOrganizationPackages(tenantId, organizationId);
    }

    // Package Test Management
    async assignTestsToPackage(tenantId: number, tests: PrimeLimsTablepackage_tests[]): Promise<number> {
        return await this.packageTestRepo.createPackageTest(tenantId, tests);
    }

    async getPackageTests(tenantId: number, packageId?: number): Promise<PrimeLimsTablepackage_tests[]> {
        return await this.packageTestRepo.getPackageTests(tenantId, packageId);
    }

    // Complex Operations
    async createPackageWithTests(
        tenantId: number, 
        packageData: PrimeLimsTablepackages, 
        tests: PrimeLimsTablepackage_tests[]
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
        await this.clinicianPackageRepo.deleteClinicianPackage(tenantId, packageId);
        await this.organizationPackageRepo.deleteOrganizationPackage(tenantId, packageId);
        await this.packageRepo.deletePackage(tenantId, packageId);
    }
}
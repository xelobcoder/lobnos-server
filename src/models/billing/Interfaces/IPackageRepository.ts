import { ClinicianPackage, OrganizationPackage, Package, PackageAssignment, PackageAssignmentType, PackageTest } from '../entities/Package.entities';

export { ClinicianPackage, OrganizationPackage, Package, PackageAssignment, PackageAssignmentType, PackageTest };

export interface IPackageAssignmentRepository {
    createAssignments(tenantId: number, data: PackageAssignment[]): Promise<number[]>;
    getAssignments(tenantId: number, assignmentType: PackageAssignmentType, entityId?: number): Promise<PackageAssignment[]>;
    updateAssignment(tenantId: number, id: number, updates: Partial<PackageAssignment>): Promise<number>;
    replaceAssignmentsForPackage(tenantId: number, packageId: number, data: PackageAssignment[]): Promise<number>;
    deleteAssignmentsForPackage(tenantId: number, packageId: number, assignmentType?: PackageAssignmentType): Promise<number>;
}

export interface IPackageRepository {
    createPackage(tenantId: number, data: Package): Promise<number[]>;
    getPackages(tenantId: number, id?: number): Promise<Package | Package[]>;
    updatePackage(tenantId: number, id: number, updates: Partial<Package>): Promise<number>;
    deletePackage(tenantId: number, id: number): Promise<number>;
    getPackagesWithPagination(tenantId: number, page?: number, count?: number): Promise<{ data: Package[] }>;
}

export interface IPackageTestRepository {
    createPackageTest(tenantId: number, data: PackageTest[]): Promise<number>;
    getPackageTests(tenantId: number, id?: number): Promise<PackageTest[]>;
    updatePackageTest(tenantId: number, id: number, updates: Partial<PackageTest>): Promise<number>;
    deletePackageTest(tenantId: number, id: number): Promise<number>;
}
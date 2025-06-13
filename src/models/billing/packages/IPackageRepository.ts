import { PrimeLimsTableclinician_packages, PrimeLimsTableorganization_packages, PrimeLimsTablepackage_tests, PrimeLimsTablepackages } from "../../../database/DatabaseTableSchema";

export interface IPackageRepository {
    createPackage(tenantId: number, data: PrimeLimsTablepackages): Promise<number[]>;
    getPackages(tenantId: number, id?: number): Promise<PrimeLimsTablepackages | PrimeLimsTablepackages[]>;
    updatePackage(tenantId: number, id: number, updates: Partial<PrimeLimsTablepackages>): Promise<number>;
    deletePackage(tenantId: number, id: number): Promise<number>;
    getPackagesWithPagination(tenantId: number, page?: number, count?: number): Promise<{ data: PrimeLimsTablepackages[] }>;
}

export interface IClinicianPackageRepository {
    createClinicianPackage(tenantId: number, data: PrimeLimsTableclinician_packages[]): Promise<number[]>;
    getClinicianPackages(tenantId: number, clinicianId: number): Promise<PrimeLimsTableclinician_packages[]>;
    updateClinicianPackage(tenantId: number, id: number, updates: Partial< PrimeLimsTableclinician_packages>): Promise<number>;
    deleteClinicianPackage(tenantId: number, id: number): Promise<number>;
}

export interface IOrganizationPackageRepository {
    createOrganizationPackage(tenantId: number, data: PrimeLimsTableorganization_packages[]): Promise<number[]>;
    getOrganizationPackages(tenantId: number, id?: number): Promise<PrimeLimsTableorganization_packages[]>;
    updateOrganizationPackage(tenantId: number, id: number, data: PrimeLimsTableorganization_packages[]): Promise<number>;
    deleteOrganizationPackage(tenantId: number, id: number): Promise<number>;
}

export interface IPackageTestRepository {
    createPackageTest(tenantId: number, data: PrimeLimsTablepackage_tests[]): Promise<number>;
    getPackageTests(tenantId: number, id?: number): Promise<PrimeLimsTablepackage_tests[]>;
    updatePackageTest(tenantId: number, id: number, updates: Partial<PrimeLimsTablepackage_tests>): Promise<number>;
    deletePackageTest(tenantId: number, id: number): Promise<number>;
}
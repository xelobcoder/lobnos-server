import { PackageRepository } from './PackageRepository';
import { ClinicianPackageRepository } from './ClinicianPackageRepository';
import { OrganizationPackageRepository } from './OrganizationPackageRepository';
import { PackageTestRepository } from './PackageTestRepository';
import { PackageService } from './PackageService';

export const createPackageService = () => {
    const packageRepo = new PackageRepository();
    const clinicianPackageRepo = new ClinicianPackageRepository();
    const organizationPackageRepo = new OrganizationPackageRepository();
    const packageTestRepo = new PackageTestRepository();

    return new PackageService(
        packageRepo,
        clinicianPackageRepo,
        organizationPackageRepo,
        packageTestRepo
    );
};

export { PackageService };
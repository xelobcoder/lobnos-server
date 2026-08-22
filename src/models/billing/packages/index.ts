import { PackageRepository } from '../repositories/PackageRepository';
import { PackageAssignmentRepository } from '../repositories/PackageAssignmentRepository';
import { PackageTestRepository } from '../repositories/PackageTestRepository';
import { PackageService } from './PackageService';

export const createPackageService = () => {
    const packageRepo = new PackageRepository();
    const packageAssignmentRepo = new PackageAssignmentRepository();
    const packageTestRepo = new PackageTestRepository();

    return new PackageService(
        packageRepo,
        packageAssignmentRepo,
        packageTestRepo
    );
};

export { PackageService };
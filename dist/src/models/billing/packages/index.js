"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageService = exports.createPackageService = void 0;
const PackageRepository_1 = require("./PackageRepository");
const ClinicianPackageRepository_1 = require("./ClinicianPackageRepository");
const OrganizationPackageRepository_1 = require("./OrganizationPackageRepository");
const PackageTestRepository_1 = require("./PackageTestRepository");
const PackageService_1 = require("./PackageService");
Object.defineProperty(exports, "PackageService", { enumerable: true, get: function () { return PackageService_1.PackageService; } });
const createPackageService = () => {
    const packageRepo = new PackageRepository_1.PackageRepository();
    const clinicianPackageRepo = new ClinicianPackageRepository_1.ClinicianPackageRepository();
    const organizationPackageRepo = new OrganizationPackageRepository_1.OrganizationPackageRepository();
    const packageTestRepo = new PackageTestRepository_1.PackageTestRepository();
    return new PackageService_1.PackageService(packageRepo, clinicianPackageRepo, organizationPackageRepo, packageTestRepo);
};
exports.createPackageService = createPackageService;

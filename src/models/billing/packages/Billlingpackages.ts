import { PrimeLimsTableclinician_packages, PrimeLimsTablepackages } from "../../../database/DatabaseTableSchema";
import KnexConnection from "../../../database/KnexConnections";

interface ClinicianPackage {
     clinician_id: number;
     package_id: number;
     assigned_at?: string;
     created_by: number;
}

interface OrganizationPackage {
     organization_id: number;
     package_id: number;
     assigned_at?: string;
}

interface Package {
     package_name: string;
     created_at?: string;
     updated_at?: string;
     created_by: number;
}

interface PackageTest {
     package_id: number;
     test_id: number;
     concession_mode: string;
     concession_value?: number;
}

interface UpdatePayload {
     [key: string]: any;
}

interface PaginationParams {
     page?: number;
     limit?: number;
     search?: string;
     sortBy?: string;
     sortOrder?: 'asc' | 'desc';
}

export class Packages {
     static async createClinicianPackage(tenantId: number, data: ClinicianPackage[]): Promise<number[] | string> {
          try {
               const connection = await KnexConnection(tenantId);

               if (!data?.length) {
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

                    return result.map((row: { id: number }) => row.id);
               }

               if (recordsToDelete.length === 0 && recordsToInsert.length === 0) {
                    throw new Error('No new records to insert. All provided clinician packages already exist.');
               }


               if (recordsToDelete.length > 0 && recordsToInsert.length === 0) {
                    return `${recordsToDelete.length} clinician package(s) successfully deleted. No new records to insert.`;
               }

               return [];
          } catch (error) {
               throw new Error(`Error creating clinician packages: ${error.message}`);
          }
     }

     static async getPackagesApplicableClinicians(tenantId: number, id: number | null = null): Promise<any> {
          const connection = await KnexConnection(tenantId);
          if (id) {
               return await connection('clinician_packages')
                    .join('clinicianbasicinfo', 'clinicianbasicinfo.id', '=', 'clinician_packages.clinician_id')
                    .where({ 'clinician_packages.package_id': id })
                    .select('clinician_packages.*', 'clinicianbasicinfo.name', 'clinicianbasicinfo.location', 'clinicianbasicinfo.phone');
          }
          return await connection('clinician_packages').select('*');
     }

     static async getPackagesByIds(tenantId: number, packageIds: number[]): Promise<PrimeLimsTablepackages[]> {
          const connection = await KnexConnection(tenantId);
          try {
               const packages = await connection('packages')
                    .whereIn('id', packageIds)
                    .select('*');
               return packages;
          } catch (error) {
               console.error('Error fetching packages:', error);
               throw error;
          }
     }

     static async getClinicianPackages(tenantId: number, clinician_id: number): Promise<PrimeLimsTablepackages[]> {
          const connection = await KnexConnection(tenantId);
          if (clinician_id) {
               const result: PrimeLimsTableclinician_packages[] = await connection('clinician_packages').where({ clinician_id });
               if (result && result.length > 0) {
                    const pkgIds: number[] = result.map(item => item.package_id);
                    return await this.getPackagesByIds(tenantId, pkgIds);
               } else {
                    return [];
               }
          }
          return [];
     }

     static async getOrganizationPackagesByOrganizationId(tenantId: number, organization_id: number): Promise<PrimeLimsTablepackages[]> {
          const connection = await KnexConnection(tenantId);
          const result: OrganizationPackage[] = await connection('organization_packages').where({ organization_id });
          if (result && result.length > 0) {
               const pkgIds: number[] = result.map(item => item.package_id);
               return await this.getPackagesByIds(tenantId, pkgIds);
          } else {
               return [];
          }
     }

     static async updateClinicianPackage(tenantId: number, id: number, updates: UpdatePayload): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection('clinician_packages').where({ id }).update(updates);
     }

     static async deleteClinicianPackage(tenantId: number, id: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection('clinician_packages').where({ id }).del();
     }

     static async createOrganizationPackage(tenantId: number, data: OrganizationPackage[]): Promise<number[]> {
          const connection = await KnexConnection(tenantId);
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

     static async getOrganizationPackages(tenantId: number, id: number | null = null): Promise<any> {
          const connection = await KnexConnection(tenantId);
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

     static async updateOrganizationPackage(tenantId: number, id: number, data: OrganizationPackage[]): Promise<any[] | number> {
          const connection = await KnexConnection(tenantId);
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

     static async deleteOrganizationPackage(tenantId: number, id: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection('organization_packages').where({ package_id: id }).del();
     }

     static async createPackage(tenantId: number, data: Package): Promise<number[]> {
          const connection = await KnexConnection(tenantId);
          return await connection('packages').insert({
               package_name: data.package_name,
               created_at: connection.fn.now(),
               created_by: data.created_by,
               updated_at: connection.fn.now(),
          });
     }

     static async getPackages(tenantId: number, id: number | null = null): Promise<any> {
          const connection = await KnexConnection(tenantId);
          if (id) {
               return await connection('packages').where({ id }).first();
          }
          return await connection('packages').select('*');
     }

     static async updatePackage(tenantId: number, id: number, updates: UpdatePayload): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection('packages')
               .where({ id })
               .update({
                    ...updates,
                    updated_at: connection.fn.now(),
               });
     }

     static async deletePackage(tenantId: number, id: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return await connection('packages').where({ id }).del();
     }

     static async createPackageTest(tenantId: number, data: PackageTest[]): Promise<number> {
          const connection = await KnexConnection(tenantId);
          const formattedData = data.map(item => ({
               package_id: item.package_id,
               test_id: item.test_id,
               concession_mode: item.concession_mode,
               concession_value: item.concession_value || null,
          }));
          const result: number[] = [];
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

     static async getPackageTests(tenantId: number, id: number | null = null): Promise<any> {
          const connection = await KnexConnection(tenantId);
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
          } catch (err) {
               console.log(err);
               throw err;
          }
     }

     static async getPackagesWithPagination(
          tenantId: number,
          { page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'desc' }: PaginationParams
     ): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
          const connection = await KnexConnection(tenantId);
          const offset = (page - 1) * limit;

          try {
               const query = connection('packages')
                    .select(
                         'packages.*',
                         'roles.username',
                         connection.raw('COUNT(DISTINCT pt.test_id) as test_count'),
                         connection.raw('COUNT(DISTINCT cp.clinician_id) as clinician_count'),
                         connection.raw('COUNT(DISTINCT op.organization_id) as organization_count')
                    )
                    .leftJoin('package_tests as pt', 'packages.id', 'pt.package_id')
                    .leftJoin('clinician_packages as cp', 'packages.id', 'cp.package_id')
                    .leftJoin('organization_packages as op', 'packages.id', 'op.package_id')
                    .leftJoin('roles', 'roles.employeeid', 'packages.created_by')
                    .groupBy('packages.id');

               if (search) {
                    query.where('packages.package_name', 'like', `%${search}%`);
               }

               const [{ count }] = await query.clone().count('packages.id as count');
               const total = parseInt(count as string);

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
          } catch (error) {
               throw error;
          }
     }

     static async removeClinicianPackageByIds(tenantId: number, clinicianId: number, packageId: number): Promise<number> {
          try {
               const connection = await KnexConnection(tenantId);

               const result = await connection('clinician_packages')
                    .where({
                         clinician_id: clinicianId,
                         package_id: packageId
                    })
                    .del();

               return result;
          } catch (error) {
               throw new Error(`Error removing clinician package: ${error.message}`);
          }
     }

     static async getPackagesForEntity({ tenantId, entityId, entitytype, categorytrackid }: {
          tenantId: number;
          entityId?: number;
          entitytype?: string;
          categorytrackid?: number;
     }): Promise<any> {
          if (categorytrackid == 6 && entitytype === "clinician" && entityId) {
               return await this.getClinicianPackages(tenantId, entityId);
          }
          if (categorytrackid == 2 && entitytype === "organization" && entityId) {
               return await this.getOrganizationPackagesByOrganizationId(tenantId, entityId);
          }
          if (categorytrackid == 1) {
               return await this.getPackages(tenantId);
          }
          return null;
     }


     static async verifyPackageId(tenantId: number, packageId: number): Promise<boolean> {
         const packageNonReserve = await  this.getPackagesByIds(tenantId, [packageId]);
           return packageNonReserve && packageNonReserve.length > 0;
     }
}

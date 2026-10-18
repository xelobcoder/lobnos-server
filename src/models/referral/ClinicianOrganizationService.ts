import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';

export interface ClinicianOrganization {
     id: number;
     name: string;
     /** The clinician's main organization (clinicianbasicinfo.organization). */
     primary: boolean;
}

export class ClinicianOrganizationError extends Error {
     constructor(message: string, public statusCode: number) {
          super(message);
     }
}

type Db = Knex | Knex.Transaction;

/**
 * Organizations a referring clinician works at. The main organization stays in
 * clinicianbasicinfo.organization; additional ones live in clinician_organizations.
 */
export class ClinicianOrganizationService {
     constructor(private tenantId: number) { }

     private async db(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     private static async clinician(db: Db, clinicianId: number, lock = false) {
          const query = db('clinicianbasicinfo').select('id', 'organization').where({ id: clinicianId });
          const row = await (lock ? query.forUpdate() : query).first();
          if (!row) throw new ClinicianOrganizationError('Clinician not found', 404);
          return { id: Number(row.id), primary: Number(row.organization) > 0 ? Number(row.organization) : null };
     }

     static async listWith(db: Db, clinicianId: number): Promise<ClinicianOrganization[]> {
          const { primary } = await ClinicianOrganizationService.clinician(db, clinicianId);
          const rows = await db('organization as o').select('o.id', 'o.name').where((builder) => {
               builder.whereIn('o.id', db('clinician_organizations').select('organization_id').where({ clinician_id: clinicianId }));
               if (primary) builder.orWhere('o.id', primary);
          });
          return rows
               .map((row: any) => ({ id: Number(row.id), name: row.name ?? '', primary: Number(row.id) === primary }))
               .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
     }

     /** Links a clinician to an organization; linking an existing affiliation is a no-op. */
     static async linkWith(db: Db, clinicianId: number, organizationId: number): Promise<boolean> {
          const { primary } = await ClinicianOrganizationService.clinician(db, clinicianId, true);
          const organization = await db('organization').select('id').where({ id: organizationId }).first();
          if (!organization) throw new ClinicianOrganizationError('Organization not found', 404);
          if (primary === organizationId) return false;
          const existing = await db('clinician_organizations').select('id')
               .where({ clinician_id: clinicianId, organization_id: organizationId }).first();
          if (existing) return false;
          await db('clinician_organizations').insert({ clinician_id: clinicianId, organization_id: organizationId })
               .onConflict(['clinician_id', 'organization_id']).ignore();
          return true;
     }

     async list(clinicianId: number): Promise<ClinicianOrganization[]> {
          return ClinicianOrganizationService.listWith(await this.db(), clinicianId);
     }

     async link(clinicianId: number, organizationId: number): Promise<{ created: boolean; organizations: ClinicianOrganization[] }> {
          const connection = await this.db();
          return connection.transaction(async (trx) => {
               const created = await ClinicianOrganizationService.linkWith(trx, clinicianId, organizationId);
               return { created, organizations: await ClinicianOrganizationService.listWith(trx, clinicianId) };
          });
     }

     /** The main organization is changed on the clinician profile, so it cannot be unlinked here. */
     async unlink(clinicianId: number, organizationId: number): Promise<ClinicianOrganization[]> {
          const connection = await this.db();
          return connection.transaction(async (trx) => {
               const { primary } = await ClinicianOrganizationService.clinician(trx, clinicianId, true);
               if (primary === organizationId) {
                    throw new ClinicianOrganizationError('This is the clinician\'s main organization. Change it on the clinician profile.', 409);
               }
               await trx('clinician_organizations').where({ clinician_id: clinicianId, organization_id: organizationId }).del();
               return ClinicianOrganizationService.listWith(trx, clinicianId);
          });
     }
}

/** Parses a positive integer id from a route parameter or body field. */
export function parsePositiveId(value: unknown): number | null {
     const text = String(value ?? '').trim();
     if (!/^\d+$/.test(text)) return null;
     const id = Number(text);
     return Number.isSafeInteger(id) && id > 0 ? id : null;
}

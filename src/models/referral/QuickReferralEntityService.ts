import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { applyClinicianAfterInsert, applyOrganizationAfterInsert } from '../../database/appLevelTriggers';
import { ReferralCodingRepo } from './repositories/ReferralCodingRepo';
import { QuickReferralEntityInput, QuickReferralEntityKind } from './quickReferralEntity';
import { ClinicianOrganizationService } from './ClinicianOrganizationService';

export interface QuickReferralEntityResult {
     id: number;
     name: string;
     entitytype: QuickReferralEntityKind;
     created: boolean;
}

/**
 * Creates referral organizations/clinicians from the billing page with only a name.
 * An existing record with the same name (or, for clinicians, the same phone) is returned
 * instead of creating a duplicate, so repeated quick-adds stay idempotent.
 */
export class QuickReferralEntityService {
     constructor(private tenantId: number) { }

     async createOrganization(input: QuickReferralEntityInput): Promise<QuickReferralEntityResult> {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx: Knex.Transaction): Promise<QuickReferralEntityResult> => {
               const existing = await trx('organization').select('id', 'name')
                    .whereRaw('LOWER(TRIM(name)) = ?', [input.name.toLowerCase()]).first();
               if (existing) return { id: Number(existing.id), name: existing.name, entitytype: 'organization', created: false };

               const [id] = await trx('organization').insert({ name: input.name, mobile: input.phone, email: input.email });
               await applyOrganizationAfterInsert(trx, Number(id));
               await new ReferralCodingRepo(this.tenantId).create({ entity_id: Number(id), entity_type: 'organization', code: 0 } as any, trx);
               return { id: Number(id), name: input.name, entitytype: 'organization', created: true };
          });
     }

     async createClinician(input: QuickReferralEntityInput): Promise<QuickReferralEntityResult> {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx: Knex.Transaction): Promise<QuickReferralEntityResult> => {
               const result = await this.findOrCreateClinician(trx, input);
               // The same clinician can refer from several organizations, so an existing match is linked too.
               if (input.organizationId) await ClinicianOrganizationService.linkWith(trx, result.id, input.organizationId);
               return result;
          });
     }

     private async findOrCreateClinician(trx: Knex.Transaction, input: QuickReferralEntityInput): Promise<QuickReferralEntityResult> {
          const existing = input.phone
               ? await trx('clinicianbasicinfo').select('id', 'name').where({ phone: input.phone }).first()
               : await trx('clinicianbasicinfo').select('id', 'name')
                    .whereRaw('LOWER(TRIM(name)) = ?', [input.name.toLowerCase()]).orderBy('id', 'asc').first();
          if (existing) return { id: Number(existing.id), name: existing.name, entitytype: 'clinician', created: false };

          const [id] = await trx('clinicianbasicinfo').insert({ name: input.name, phone: input.phone, email: input.email });
          const row = await trx('clinicianbasicinfo').select('identifier').where({ id }).first();
          await applyClinicianAfterInsert(this.tenantId, trx, { clinicianid: Number(id), identifier: row?.identifier ? String(row.identifier) : '' });
          await new ReferralCodingRepo(this.tenantId).create({ entity_id: Number(id), entity_type: 'clinician', code: 0 } as any, trx);
          return { id: Number(id), name: input.name, entitytype: 'clinician', created: true };
     }
}

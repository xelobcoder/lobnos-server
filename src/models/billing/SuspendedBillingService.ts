import KnexConnection from '../../database/KnexConnections';
import { AuthUser } from '../../middleware/authority';

export interface SuspendedBillingDraftInput {
     patientid?: number | null;
     isPricingQuote?: boolean;
     billingSource: number;
     entitytype?: string | null;
     entityId?: number | null;
     entityname?: string | null;
     referalCode?: string | null;
     specialCode?: string | null;
     useSpecialCode?: boolean;
     selectedTestIds: number[];
     selectedServiceIds: number[];
     selectedTestOptions?: Array<{ testid: number; outsourceid?: number | null; userAdjustedValue?: number | null; userAdjustmentType?: string | null }>;
     isPackageUsed?: boolean;
     packageid?: number | null;
     includeServices?: boolean;
     nhismembershipid?: number | null;
     claimscheckcode?: number | null;
     isPromo?: boolean;
     promoCode?: string | null;
     promoMethod?: string | null;
     promoAmount?: number | null;
     notes?: string | null;
}

export class SuspendedBillingService {
     constructor(private readonly tenantId: number) { }

     async suspend(actor: AuthUser, input: SuspendedBillingDraftInput, draftId?: number): Promise<any> {
          this.validate(actor, input);
          const connection = await KnexConnection(this.tenantId);
          const payload = JSON.stringify(input);
          if (draftId) {
               const updated = await connection('suspended_billing_transactions')
                    .where({ id: draftId, branchid: actor.branch, status: 'suspended' })
                    .update({
                         patientid: input.patientid || null,
                         billing_source: input.billingSource,
                         entity_type: input.entitytype || null,
                         entity_id: input.entityId || null,
                         draft_data: payload,
                         notes: input.notes || null,
                         updated_by: actor.employeeid,
                         updated_at: new Date(),
                    });
               if (!updated) throw new Error('Suspended transaction was not found or is no longer editable');
               return { id: draftId, status: 'suspended' };
          }

          const [id] = await connection('suspended_billing_transactions').insert({
               patientid: input.patientid || null,
               branchid: actor.branch,
               billing_source: input.billingSource,
               entity_type: input.entitytype || null,
               entity_id: input.entityId || null,
               draft_data: payload,
               notes: input.notes || null,
               status: 'suspended',
               created_by: actor.employeeid,
               updated_by: actor.employeeid,
               created_at: new Date(),
               updated_at: new Date(),
          });
          return { id: Number(id), status: 'suspended' };
     }

     async list(actor: AuthUser): Promise<any[]> {
          if (actor.branch === null) throw new Error('An assigned branch is required to view suspended transactions');
          const connection = await KnexConnection(this.tenantId);
          return connection('suspended_billing_transactions as draft')
               .leftJoin('new_patients as patient', 'patient.patientid', 'draft.patientid')
               .leftJoin('roles as creator', 'creator.employeeid', 'draft.created_by')
               .select(
                    'draft.id',
                    'draft.patientid',
                    'draft.branchid',
                    'draft.billing_source',
                    'draft.entity_type',
                    'draft.entity_id',
                    'draft.notes',
                    'draft.status',
                    connection.raw("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(draft.draft_data, '$.isPricingQuote')), 'false') as is_pricing_quote"),
                    'draft.created_by',
                    'draft.created_at',
                    'draft.updated_at',
                    'creator.username as created_by_name',
                    connection.raw('CONCAT_WS(" ", patient.firstname, patient.middlename, patient.lastname) as patient_name')
               )
               .where({ 'draft.branchid': actor.branch, 'draft.status': 'suspended' })
               .orderBy('draft.updated_at', 'desc');
     }

     async get(actor: AuthUser, draftId: number): Promise<any> {
          if (actor.branch === null) throw new Error('An assigned branch is required to load a suspended transaction');
          const connection = await KnexConnection(this.tenantId);
          const draft = await connection('suspended_billing_transactions')
               .where({ id: draftId, branchid: actor.branch, status: 'suspended' })
               .first();
          if (!draft) throw new Error('Suspended transaction was not found');
          let draftData = draft.draft_data;
          if (typeof draftData === 'string') draftData = JSON.parse(draftData);
          return { ...draft, draft_data: draftData };
     }

     async cancel(actor: AuthUser, draftId: number): Promise<void> {
          if (actor.branch === null) throw new Error('An assigned branch is required to cancel suspended transactions');
          const connection = await KnexConnection(this.tenantId);
          const updated = await connection('suspended_billing_transactions')
               .where({ id: draftId, branchid: actor.branch, status: 'suspended' })
               .update({ status: 'cancelled', updated_by: actor.employeeid, updated_at: new Date() });
          if (!updated) throw new Error('Suspended transaction was not found or is no longer active');
     }

     async finalize(actor: AuthUser, draftId: number, billingId: number): Promise<void> {
          const connection = await KnexConnection(this.tenantId);
          const draft = await connection('suspended_billing_transactions').where({ id: draftId }).first();
          if (!draft) throw new Error('Suspended transaction was not found');
          if (draft.status === 'finalized' && Number(draft.finalized_billingid) === billingId) return;
          if (draft.status !== 'suspended') throw new Error('Suspended transaction is no longer active');
          if (actor.branch === null || Number(actor.branch) !== Number(draft.branchid)) throw new Error('Suspended transaction is not active for your branch');
          await connection.transaction(async (trx: any) => {
               const bill = await trx('billing').where({ billingid: billingId }).first();
               let draftData = draft.draft_data;
               if (typeof draftData === 'string') draftData = JSON.parse(draftData);
               const isPatientlessQuote = !draft.patientid && Boolean(draftData?.isPricingQuote);
               if (!bill || (!isPatientlessQuote && Number(bill.patientid) !== Number(draft.patientid)) || Number(bill.branchid) !== Number(draft.branchid)) {
                    throw new Error('Final billing record does not match the suspended patient and branch');
               }
               const updated = await trx('suspended_billing_transactions')
                    .where({ id: draftId, branchid: draft.branchid, status: 'suspended' })
                    .update({
                         status: 'finalized',
                         patientid: draft.patientid || Number(bill.patientid),
                         finalized_billingid: billingId,
                         finalized_by: actor.employeeid,
                         finalized_at: new Date(),
                         updated_by: actor.employeeid,
                         updated_at: new Date(),
                    });
               if (!updated) throw new Error('Suspended transaction could not be finalized');
          });
     }

     private validate(actor: AuthUser, input: SuspendedBillingDraftInput): void {
          if (actor.branch === null) throw new Error('An assigned branch is required to suspend a transaction');
          if (!input.isPricingQuote && (!Number.isSafeInteger(Number(input.patientid)) || Number(input.patientid) <= 0)) throw new Error('Select a patient before suspending this transaction');
          if (![1, 2, 3, 4, 6].includes(Number(input.billingSource))) throw new Error('A valid billing source is required');
          if (Number(input.billingSource) > 1 && Number(input.billingSource) !== 4 && !Number(input.entityId)) throw new Error('Select the billing entity before suspending this transaction');
          if (Number(input.billingSource) === 4 && (!input.nhismembershipid || !input.claimscheckcode)) throw new Error('NHIS membership and claim check codes are required before suspending');
          if (!Array.isArray(input.selectedTestIds) || !Array.isArray(input.selectedServiceIds)) throw new Error('Selected tests and services must be provided');
          if (input.selectedTestIds.length === 0 && input.selectedServiceIds.length === 0 && !input.isPackageUsed) throw new Error('Select at least one test, service, or package before suspending');
          if ((input as any).isAdjustment) throw new Error('Existing billing adjustments cannot be suspended as new transactions');
     }
}

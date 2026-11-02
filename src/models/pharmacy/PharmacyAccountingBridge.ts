import { Knex } from 'knex';
import { AccountingRepository } from '../../accountingModule/repositories/AccountingRepository';
import { AccountingService } from '../../accountingModule/services/AccountingService';
import { NormalBalance } from '../../accountingModule/enums/normal-balance.enum';
import { SourceModule } from '../../accountingModule/enums/source-module.enum';
import { TransactionType } from '../../accountingModule/enums/transaction-type.enum';
import type { PharmacyJournalLine } from './PharmacyLedger';
import { accountGroup } from './PharmacyFinancialReports';
import { PostTransactionLineDto } from '../../accountingModule/dto/PostTransactionLineDto';
import { SubledgerService } from '../../accountingModule/services/SubledgerService';

export interface PharmacyPostingSettings {
     branchid: number;
     tenant_id: number;
     enabled: boolean | number;
     effective_date: string | Date | null;
     mappings: Record<string, string> | string | null;
}

export interface PharmacyJournalSource {
     id: string;
     branchid: number;
     source_ref: string;
     kind: string;
     description: string;
     financial_date: string | Date;
     created_by: number;
}

export function pharmacyPostingMappings(value: PharmacyPostingSettings['mappings']): Record<string, string> {
     const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
     if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Configure pharmacy GL account mappings before enabling posting');
     const result: Record<string, string> = {};
     for (const [key, code] of Object.entries(parsed)) {
          if (typeof code !== 'string' || !code.trim()) throw new Error(`Invalid pharmacy GL mapping for ${key}`);
          result[key] = code;
     }
     return result;
}

export async function mappedPharmacyAccount(
     db: Knex | Knex.Transaction,
     branch: number,
     code: string,
     mappings: Record<string, string>,
): Promise<string> {
     let category = code === 'supplier_payable' ? 'payable' : code.split(':')[0];
     if (category === 'collection') {
          const account = await db('pharmacy_collection_accounts').where({ id: Number(code.slice(11)), branchid: branch }).first();
          if (!account) throw new Error(`Pharmacy collection account ${code} does not belong to this branch`);
          category = account.account_type;
     }
     if (category === 'payable' && !await db('pharmacy_suppliers').where({ id: code.slice(8), branchid: branch }).first()) throw new Error('Supplier payable does not belong to this pharmacy branch');
     if (category === 'receivable' && !await db('pharmacy_customer_accounts').where({ id: Number(code.slice(11)), branchid: branch }).first()) throw new Error('Customer receivable does not belong to this pharmacy branch');
     const mapped = mappings[code] || mappings[category];
     if (!mapped) throw new Error(`Map pharmacy account ${code} to an active GL account before posting`);
     if (code === 'liability:grni' && (mapped === 'acc-2000' || mapped === mappings.payable || mapped === mappings.supplier_payable))
          throw new Error('Goods received not invoiced requires its own liability control account, separate from supplier payables');
     const shared = await db('acc_accounts').where({ account_code: mapped }).first();
     const expectedType = { Assets: 'asset', Liabilities: 'liability', Equity: 'equity', Revenue: 'revenue', Expenses: 'expense' }[accountGroup(code)];
     if (!expectedType || !shared || !Number(shared.is_active) || shared.type !== expectedType) throw new Error(`Pharmacy account ${code} requires an active ${expectedType || 'classified'} GL account`);
     return mapped;
}

export async function synchronizePharmacyJournal(
     trx: Knex.Transaction,
     source: PharmacyJournalSource,
     lines: PharmacyJournalLine[],
     options: { historical?: boolean } = {},
): Promise<number | null> {
     const settings = await trx<PharmacyPostingSettings>('pharmacy_accounting_settings')
          .where({ branchid: source.branchid }).forUpdate().first();
     if (!settings || !Number(settings.enabled)) return null;
     if (!Number.isSafeInteger(Number(settings.tenant_id)) || Number(settings.tenant_id) <= 0) throw new Error('Pharmacy accounting tenant configuration is invalid');
     const date = source.financial_date instanceof Date ? source.financial_date.toISOString().slice(0, 10) : source.financial_date.slice(0, 10);
     const effective = settings.effective_date instanceof Date ? settings.effective_date.toISOString().slice(0, 10) : settings.effective_date?.slice(0, 10);
     if (!effective) throw new Error('Configure a pharmacy accounting effective date before posting');
     if (!options.historical && date < effective) throw new Error('This journal predates the pharmacy GL cutover; use the reviewed consolidation workflow');
     const linked = await trx('pharmacy_accounting_posting_links').where({ journal_id: source.id }).first();
     if (linked) return Number(linked.shared_entry_id);
     const mappings = pharmacyPostingMappings(settings.mappings);
     const mappedLines: PostTransactionLineDto[] = [];
     const subledger = new SubledgerService(Number(settings.tenant_id));
     for (const [index, line] of lines.entries()) {
          const accountCode = await mappedPharmacyAccount(trx, source.branchid, line.account, mappings);
          let party: Pick<PostTransactionLineDto, 'partyType' | 'partyRef' | 'partyName' | 'documentRef'> = {};
          if (line.account.startsWith('receivable:')) {
               const customer = await trx('pharmacy_customer_accounts').where({ id: Number(line.account.slice(11)), branchid: source.branchid }).first();
               const event = source.kind === 'receivable_collection' ? await trx('pharmacy_cash_events').where({ id: source.source_ref, branchid: source.branchid }).first() : null;
               party = { partyType: 'pharmacy_patient', partyRef: String(customer.patient_id), partyName: `Patient #${customer.patient_id}`, documentRef: line.documentRef || event?.sale_id || source.source_ref };
               await subledger.record({ ledger: 'AR', partyType: party.partyType!, partyId: Number(customer.patient_id), partyName: party.partyName, documentType: 'adjustment', documentRef: party.documentRef!, documentDate: date, amount: Number(line.debit || 0) - Number(line.credit || 0), sourceModule: 'pharmacy', sourceTable: 'pharmacy_journal_lines', sourceRef: `${source.id}:${index}`, branchid: source.branchid }, trx);
          } else if (line.account.startsWith('payable:')) {
               const supplier = await trx('pharmacy_suppliers').where({ id: line.account.slice(8), branchid: source.branchid }).first();
               party = { partyType: 'pharmacy_supplier', partyRef: String(supplier.id), partyName: `${supplier.name || 'Supplier'} (${supplier.id})`.slice(0, 160), documentRef: line.documentRef || source.source_ref };
               await subledger.record({ ledger: 'AP', partyType: party.partyType!, partyId: null, partyName: party.partyName, documentType: 'adjustment', documentRef: party.documentRef!, documentDate: date, amount: Number(line.credit || 0) - Number(line.debit || 0), sourceModule: 'pharmacy', sourceTable: 'pharmacy_journal_lines', sourceRef: `${source.id}:${index}`, branchid: source.branchid }, trx);
          }
          if (line.debit) mappedLines.push({ accountCode, direction: NormalBalance.DEBIT, amount: line.debit, branchid: source.branchid, ...party });
          if (line.credit) mappedLines.push({ accountCode, direction: NormalBalance.CREDIT, amount: line.credit, branchid: source.branchid, ...party });
     }
     const { entry } = await new AccountingService(new AccountingRepository(Number(settings.tenant_id))).postTransaction({
          tenantId: Number(settings.tenant_id),
          trx,
          sourceModule: SourceModule.PHARMACY,
          sourceTable: 'pharmacy_journals',
          sourcePk: 0,
          sourceRef: source.id,
          transactionType: TransactionType.ADJUSTMENT,
          occurredAt: date,
          createdBy: source.created_by,
          description: `${source.kind}: ${source.description}`.slice(0, 255),
          lines: mappedLines,
     });
     await trx('pharmacy_accounting_posting_links').insert({
          journal_id: source.id,
          shared_entry_id: entry.id,
          branchid: source.branchid,
          created_at: new Date(),
     });
     return entry.id;
}

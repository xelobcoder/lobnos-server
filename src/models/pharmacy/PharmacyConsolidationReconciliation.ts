import { Knex } from "knex";
import Decimal from "decimal.js";
import { mappedPharmacyAccount, pharmacyPostingMappings, PharmacyPostingSettings } from "./PharmacyAccountingBridge";
import { pharmacyAccountingDate } from "./PharmacyGeneralLedger";

export const PHARMACY_CONSOLIDATION_REVIEW_LIMIT = 100;

export async function pharmacyConsolidationReconciliation(
     db: Knex | Knex.Transaction,
     branch: number,
     filters: { from?: string; to?: string } = {},
) {
     if (!Number.isSafeInteger(branch) || branch < 1) throw new Error("An operating pharmacy branch is required");
     const from = filters.from ? pharmacyAccountingDate(filters.from, "start date") : undefined;
     const to = filters.to ? pharmacyAccountingDate(filters.to, "end date") : new Date().toISOString().slice(0, 10);
     if (from && from > to) throw new Error("The start date must be on or before the end date");
     const settings = await db<PharmacyPostingSettings>("pharmacy_accounting_settings")
          .where({ branchid: branch })
          .first();
     if (!settings) throw new Error("Configure pharmacy account mappings before reconciling the consolidated GL");
     const mappings = pharmacyPostingMappings(settings.mappings);
     const mappingCache = new Map<string, string>();
     const rows: Awaited<ReturnType<typeof reconcileBatch>>["rows"] = [];
     let after: string | undefined,
          journalCount = 0,
          unlinked = 0,
          linkedMismatchCount = 0;
     let shownLinked = 0,
          shownUnlinked = 0,
          shownMismatches = 0,
          shownJournals = 0;
     // Inspect every source, but retain only bounded review samples.
     for (;;) {
          const query = db("pharmacy_journals")
               .where({ branchid: branch })
               .where("financial_date", "<=", to)
               .select("id")
               .orderBy("id")
               .limit(PHARMACY_CONSOLIDATION_REVIEW_LIMIT);
          if (from) query.where("financial_date", ">=", from);
          if (after) query.where("id", ">", after);
          const headers = await query;
          if (!headers.length) break;
          after = String(headers[headers.length - 1].id);
          const result = await reconcileBatch(
               db,
               branch,
               { from, to, journalIds: headers.map((header) => String(header.id)) },
               mappings,
               mappingCache,
          );
          if (result.journalCount !== headers.length)
               throw new Error("A pharmacy source journal has no posted line evidence");
          journalCount += result.journalCount;
          unlinked += result.unlinked;
          const grouped = new Map<string, typeof result.rows>();
          for (const row of result.rows) {
               if (!grouped.has(row.journal_id)) grouped.set(row.journal_id, []);
               grouped.get(row.journal_id)!.push(row);
          }
          for (const header of headers) {
               const items = grouped.get(String(header.id))!;
               const missing = items[0].shared_entry_id == null;
               const mismatch =
                    !missing && items.some((item) => item.debitDifference !== 0 || item.creditDifference !== 0);
               if (mismatch) linkedMismatchCount++;
               const show = missing
                    ? shownUnlinked++ < PHARMACY_CONSOLIDATION_REVIEW_LIMIT
                    : shownLinked++ < PHARMACY_CONSOLIDATION_REVIEW_LIMIT;
               const showMismatch = mismatch && shownMismatches++ < PHARMACY_CONSOLIDATION_REVIEW_LIMIT;
               if (show || showMismatch) {
                    rows.push(...items);
                    shownJournals++;
               }
          }
     }
     const orphanQuery = db("acc_journal_entries as e")
          .leftJoin("acc_journal_lines as l", "l.journal_entry_id", "e.id")
          .leftJoin("pharmacy_journals as source", "source.id", "e.source_ref")
          .leftJoin("pharmacy_accounting_posting_links as p", (join) =>
               join.on("p.shared_entry_id", "e.id").andOnVal("p.branchid", branch),
          )
          .where("e.source_module", "pharmacy")
          .where((scope) => scope.where("l.branchid", branch).orWhere("source.branchid", branch))
          .whereNull("p.journal_id")
          .whereNot("e.status", "voided")
          .whereRaw("DATE(e.occurred_at) <= ?", [to])
          .distinct("e.id", "e.source_table", "e.source_ref");
     if (from) orphanQuery.whereRaw("DATE(e.occurred_at) >= ?", [from]);
     const orphanTotal = await db.from(orphanQuery.clone().as("orphans")).count("* as total").first();
     const unlinkedShared = Number(orphanTotal?.total || 0);
     const orphanSharedEntries = await orphanQuery.orderBy("e.id").limit(PHARMACY_CONSOLIDATION_REVIEW_LIMIT);
     return {
          from: from || null,
          to,
          rows,
          journalCount,
          unlinked,
          linkedMismatchCount,
          fullyChecked: true,
          reviewLimit: PHARMACY_CONSOLIDATION_REVIEW_LIMIT,
          rowsTruncated: shownJournals < journalCount,
          unlinkedShared,
          orphanSharedEntries,
          orphanSharedEntriesTruncated: unlinkedShared > orphanSharedEntries.length,
          balanced: unlinked === 0 && unlinkedShared === 0 && linkedMismatchCount === 0,
     };
}

async function reconcileBatch(
     db: Knex | Knex.Transaction,
     branch: number,
     filters: { from?: string; to: string; journalIds: string[] },
     mappings: Record<string, string>,
     mappingCache: Map<string, string>,
) {
     const { from, to } = filters;
     const q = db("pharmacy_journal_lines as l")
          .join("pharmacy_journals as j", "j.id", "l.journal_id")
          .leftJoin("pharmacy_accounting_posting_links as p", "p.journal_id", "j.id")
          .where("j.branchid", branch)
          .where("j.financial_date", "<=", to)
          .whereIn("j.id", filters.journalIds)
          .select(
               "j.id as journal_id",
               "j.source_ref",
               "l.account_code",
               "p.shared_entry_id",
               "p.branchid as link_branch",
               db.raw("ROUND(SUM(l.debit), 2) as debit"),
               db.raw("ROUND(SUM(l.credit), 2) as credit"),
               db.raw(
                    "SUM(CASE WHEN l.debit IS NULL OR l.credit IS NULL OR l.debit < 0 OR l.credit < 0 OR l.debit <> ROUND(l.debit, 2) OR l.credit <> ROUND(l.credit, 2) OR (l.debit > 0 AND l.credit > 0) OR (l.debit = 0 AND l.credit = 0) THEN 1 ELSE 0 END) as invalid_lines",
               ),
          )
          .groupBy("j.id", "j.source_ref", "l.account_code", "p.shared_entry_id", "p.branchid");
     if (from) q.where("j.financial_date", ">=", from);
     const local = await q;
     type Balance = {
          journal_id: string;
          source_ref: string;
          shared_entry_id: number | null;
          account_code: string;
          localDebit: Decimal;
          localCredit: Decimal;
          sharedDebit: Decimal;
          sharedCredit: Decimal;
     };
     const balances = new Map<string, Balance>(),
          journals = new Map<string, number | null>();
     const sourceRefs = new Map(local.map((line) => [line.journal_id, line.source_ref]));
     const get = (journal: string, reference: string, shared: number | null, code: string) => {
          const key = `${journal}:${code}`;
          if (!balances.has(key))
               balances.set(key, {
                    journal_id: journal,
                    source_ref: reference,
                    shared_entry_id: shared,
                    account_code: code,
                    localDebit: new Decimal(0),
                    localCredit: new Decimal(0),
                    sharedDebit: new Decimal(0),
                    sharedCredit: new Decimal(0),
               });
          return balances.get(key)!;
     };
     for (const line of local) {
          if (Number(line.invalid_lines))
               throw new Error("A pharmacy source journal contains invalid posted line evidence");
          if (line.shared_entry_id != null && Number(line.link_branch) !== branch)
               throw new Error("A pharmacy consolidation link belongs to another branch");
          journals.set(line.journal_id, line.shared_entry_id == null ? null : Number(line.shared_entry_id));
          if (!mappingCache.has(line.account_code))
               mappingCache.set(
                    line.account_code,
                    await mappedPharmacyAccount(db, branch, line.account_code, mappings),
               );
          const code = mappingCache.get(line.account_code)!;
          const balance = get(line.journal_id, line.source_ref, line.shared_entry_id, code);
          balance.localDebit = balance.localDebit.plus(line.debit);
          balance.localCredit = balance.localCredit.plus(line.credit);
     }
     const entryIds = [...new Set([...journals.values()].filter((id): id is number => id !== null))];
     const shared = entryIds.length
          ? await db("acc_journal_lines as l")
                 .join("acc_journal_entries as e", "e.id", "l.journal_entry_id")
                 .join("acc_accounts as a", "a.id", "l.account_id")
                 .whereIn("e.id", entryIds)
                 .select(
                      "e.id",
                      "e.source_module",
                      "e.source_table",
                      "e.source_ref",
                      "e.status",
                      "l.branchid",
                      "l.direction",
                      "a.account_code",
                      db.raw("ROUND(SUM(l.amount), 2) as amount"),
                      db.raw(
                           "SUM(CASE WHEN l.amount IS NULL OR l.amount <= 0 OR l.amount <> ROUND(l.amount, 2) THEN 1 ELSE 0 END) as invalid_amounts",
                      ),
                 )
                 .groupBy(
                      "e.id",
                      "e.source_module",
                      "e.source_table",
                      "e.source_ref",
                      "e.status",
                      "l.branchid",
                      "l.direction",
                      "a.account_code",
                 )
          : [];
     for (const line of shared) {
          if (
               line.source_module !== "pharmacy" ||
               line.source_table !== "pharmacy_journals" ||
               Number(journals.get(line.source_ref)) !== Number(line.id) ||
               Number(line.branchid) !== branch ||
               line.status === "voided" ||
               !["debit", "credit"].includes(line.direction) ||
               Number(line.invalid_amounts)
          ) {
               throw new Error("A pharmacy consolidation link has invalid source, branch or posting status");
          }
          const reference = sourceRefs.get(line.source_ref) || "";
          const balance = get(line.source_ref, reference, Number(line.id), line.account_code);
          if (line.direction === "debit") balance.sharedDebit = balance.sharedDebit.plus(line.amount);
          else balance.sharedCredit = balance.sharedCredit.plus(line.amount);
     }
     const rows = [...balances.values()].map((row) => ({
          journal_id: row.journal_id,
          source_ref: row.source_ref,
          shared_entry_id: row.shared_entry_id,
          account_code: row.account_code,
          localDebit: row.localDebit.toNumber(),
          localCredit: row.localCredit.toNumber(),
          sharedDebit: row.sharedDebit.toNumber(),
          sharedCredit: row.sharedCredit.toNumber(),
          debitDifference: row.localDebit.minus(row.sharedDebit).toNumber(),
          creditDifference: row.localCredit.minus(row.sharedCredit).toNumber(),
     }));
     const unlinked = [...journals.values()].filter((value) => value === null).length;
     return {
          from: from || null,
          to,
          rows,
          journalCount: journals.size,
          unlinked,
          balanced: unlinked === 0 && rows.every((row) => row.debitDifference === 0 && row.creditDifference === 0),
     };
}

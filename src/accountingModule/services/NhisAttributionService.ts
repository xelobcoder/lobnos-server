import { resolveBillingPayers } from './BillingPayer';

function positiveId(value: any): number | undefined {
     const id = Number(value);
     return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** Resolve only explicit bill links. In particular a REFUND-history ID is not a billing ID. */
export async function attributeBillingEntries(db: any, entries: readonly any[]): Promise<any[]> {
     const links = new Map<any, number>();
     const histories = new Map<number, any[]>();
     const focs = new Map<number, any[]>();
     const refunds = new Map<number, any[]>();
     const collect = (map: Map<number, any[]>, id: number | undefined, entry: any) => {
          if (!id) return;
          if (!map.has(id)) map.set(id, []);
          map.get(id)!.push(entry);
     };
     for (const entry of entries) {
          if (entry.ledger !== 'AR' || !['patient', 'nhis'].includes(entry.party_type)) continue;
          const documentId = /^BILL-(\d+)$/.exec(entry.document_ref || '')?.[1];
          if (documentId) {
               links.set(entry, Number(documentId));
               continue;
          }
          if (entry.source_module !== 'billing') continue;
          const source = String(entry.source_ref || '');
          if (['billing', 'billing_writeoff', 'billing_void'].includes(entry.source_table)) {
               const id = positiveId(source.split(':')[0]);
               if (id) links.set(entry, id);
          } else if (entry.source_table === 'billinghx') collect(histories, positiveId(source), entry);
          else if (entry.source_table === 'staff_foc_transaction') collect(focs, positiveId(source.replace(/^reversal:/, '')), entry);
          else if (entry.source_table === 'billing_refund_events') collect(refunds, positiveId(source), entry);
     }
     await Promise.all([
          ['billinghx', 'KeyID', 'Billingid', histories],
          ['staff_foc_transaction', 'id', 'billingid', focs],
          ['billing_refund_events', 'id', 'billingid', refunds],
     ].map(async ([table, key, billKey, map]: any[]) => {
          if (!map.size) return;
          const rows = await db(table).select(key, billKey).whereIn(key, [...map.keys()]);
          for (const row of rows) {
               const billId = positiveId(row[billKey]);
               if (billId) for (const entry of map.get(Number(row[key])) || []) links.set(entry, billId);
          }
     }));
     const ids = [...new Set(links.values())];
     const payers = await resolveBillingPayers(db, ids.map((billingId) => ({ billingId })));
     return entries.map((entry) => {
          const billingId = links.get(entry);
          const payer = billingId ? payers.get(billingId) : undefined;
          if (!payer) return { ...entry };
          return {
               ...entry, billingId, classification: payer.classification,
               party_type: payer.partyType, party_id: payer.partyId,
               party_name: payer.partyName || (entry.party_type === payer.partyType ? entry.party_name : null),
          };
     });
}

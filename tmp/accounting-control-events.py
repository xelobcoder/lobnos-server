from pathlib import Path
p=Path('src/accountingModule/services/AccountingReportService.ts');s=p.read_text(encoding='utf-8')
a=s.index('          const db = await this.connection();',s.index('private async controlAccountAging'))
b=s.index('          const documents = new Map',a)
prefix=s[a:b]
c=s.index('          for (const movement of movements)',b);d=s.index('               const key =',c)
identity=s[c:d]
# introduce events helper before control aging
helper='''     private async controlEvents(ledger: 'AR' | 'AP', asOf?: string, branchId?: number) {
'''+prefix+'''          const events: any[] = [];
'''+identity+'''               events.push({ id: movement.id, reference, partyId, partyType, partyName, patientIdentifier: patient?.fullpatientid || null,
                    documentDate: new Date(movement.occurred_at).toISOString().slice(0,10),
                    amount: minorUnits(movement.amount) * (movement.direction === (ledger === 'AR' ? 'debit' : 'credit') ? 1 : -1),
                    source_table: movement.source_table, source_ref: ref });
          }
          return events;
     }

'''
# replace embedded prefix and loop identities
s=s[:a]+'''          const cutoff = asOf || new Date().toISOString().slice(0, 10);
          const movements = await this.controlEvents(ledger, cutoff, branchId);
'''+s[b:c]+'''          for (const movement of movements) {
               const { reference, partyId, partyType, partyName } = movement;
'''+s[d:]
s=s.replace("const amount = minorUnits(movement.amount) * (movement.direction === (ledger === 'AR' ? 'debit' : 'credit') ? 1 : -1);", "const amount = movement.amount;",1)
s=s.replace('date: previous?.date || movement.occurred_at, partyType, partyName, patientIdentifier: patient?.fullpatientid || null', 'date: previous?.date || movement.documentDate, partyType, partyName, patientIdentifier: movement.patientIdentifier')
s=s.replace("sumMinor(movements.map((row: any) => (row.direction === (ledger === 'AR' ? 'debit' : 'credit') ? 1 : -1) * Number(row.amount))) / 100", "movements.reduce((sum: number, row: any) => sum + row.amount, 0) / 100")
pos=s.index('     /** Posted movements');s=s[:pos]+helper+s[pos:]
# statement facade
pos=s.index('     async aging(')
s=s[:pos]+'''     async controlStatement(ledger: 'AR' | 'AP', partyType: string, partyId: string | number, from?: string, to?: string, options: any = {}) {
          if (!this.trx) { const db = await this.connection(); return db.transaction((trx: any) => new AccountingReportService(this.tenantId, trx).controlStatement(ledger, partyType, partyId, from, to, options), { isolationLevel: 'repeatable read' }); }
          const rows = (await this.controlEvents(ledger, to)).filter(row => row.partyType === partyType && String(row.partyId) === String(partyId));
          let running = rows.filter(row => from && row.documentDate < from).reduce((sum, row) => sum + row.amount, 0);
          const openingBalance = running / 100;
          const entries = rows.filter(row => !from || row.documentDate >= from).map(row => {
               running += row.amount;
               return { id: row.id, ledger, party_type: row.partyType, party_id: row.partyId, party_name: row.partyName, document_date: row.documentDate, document_ref: row.reference,
                    document_type: row.amount >= 0 ? 'charge' : 'settlement', source_table: row.source_table, source_ref: row.source_ref, amount: row.amount / 100, runningBalance: running / 100 };
          });
          const paging = parsePaging(options, 50);
          return { entries: entries.slice(paging.offset, paging.offset + paging.count), total: entries.length, page: paging.page, count: paging.count, openingBalance, closingBalance: running / 100, basis: 'accrual' };
     }

'''+s[pos:];p.write_text(s,encoding='utf-8')
p=Path('src/controllers/accounting/AccountingReportController.ts');s=p.read_text(encoding='utf-8');# specifically switch statement endpoint, preserve subledger reconciliation endpoints
start=s.index('     static async subledgerStatement');end=s.index('\n     static async ',start+15);chunk=s[start:end].replace('new SubledgerService(getTenantId(req))','new AccountingReportService(getTenantId(req))').replace('service.statement(', 'service.controlStatement(').replace('Number(req.params.partyId)', 'String(req.params.partyId)');s=s[:start]+chunk+s[end:];p.write_text(s,encoding='utf-8')

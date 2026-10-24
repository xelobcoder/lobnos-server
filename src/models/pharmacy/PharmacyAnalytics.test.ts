import { describe, expect, it, vi } from 'vitest';
import knex from 'knex';
import { PHARMACY_REPORTS, PharmacyAnalytics, pharmacyAnalyticsFilters, pharmacySalesReportQuery } from './PharmacyAnalytics';
const database=()=>{
     const db=knex({client:'mysql2'}),queries:any[]=[];
     vi.spyOn(db.client,'runner').mockImplementation(((builder:any)=>({run:async()=>{const query=builder.toSQL();queries.push(query);return query.method==='first'?{total:0}:[];}})) as any);
     return {db,queries};
};
describe('pharmacy analytics',()=>{
     it('validates dates, reporting ranges, reports and pagination',()=>{
          expect(pharmacyAnalyticsFilters({},'2026-10-24')).toMatchObject({from:'2026-09-25',to:'2026-10-24',days:30});
          for(const input of [{to:'bad'},{from:'2026-02-30'},{from:'2026-10-24',to:'2026-10-23'},{report:'invented'},{count:100000},{page:-1}])expect(()=>pharmacyAnalyticsFilters(input)).toThrow();
     });
     it('separates sale dates from refund dates and restores cost only for restocked returns',()=>{
          const db=knex({client:'mysql2'}),query=pharmacySalesReportQuery(db,7,pharmacyAnalyticsFilters({from:'2026-10-01',to:'2026-10-24'})).toSQL();
          expect(query.sql).toContain('`s`.`branchid` = ?');expect(query.bindings).toContain(7);
          expect(query.sql).toContain('s.completed_at >= ?');expect(query.sql).toContain('s.reversed_at >= ?');
          expect(query.sql).toContain("r.disposition = 'restock'");expect(query.sql).not.toContain('inv_inventory');
     });
     it.each(PHARMACY_REPORTS)('builds the %s report using branch-scoped pharmacy data',async report=>{
          const {db,queries}=database();const result=await new PharmacyAnalytics(db,7).report({report,from:'2026-10-01',to:'2026-10-24'});
          expect(result.rows).toEqual([]);expect(result.columns.length).toBeGreaterThan(0);
          expect(queries.every(query=>!query.sql.includes('inv_inventory')&&!query.sql.includes('acc_journal'))).toBe(true);
          expect(queries.filter(query=>!query.sql.includes('report_rows')).every(query=>query.bindings.includes(7))).toBe(true);
     });
     it('exports every sales row without applying the on-screen page limit',async()=>{
          const {db,queries}=database();await new PharmacyAnalytics(db,7,true).report({report:'sales'});
          const reportQueries=queries.filter(query=>query.sql.includes('pharmacy_sale_lines'));
          expect(reportQueries).toHaveLength(1);expect(reportQueries[0].sql).not.toContain('limit');
     });
});

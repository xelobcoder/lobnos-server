import {describe,it,expect} from 'vitest';
import knex from 'knex';
import {applyPharmacyHistoryFilters,validatePharmacyHistoryFilters} from './PharmacyHistoryFilters';
const db=knex({client:'mysql2'});
describe('pharmacy history filters',()=>{
 it('applies every filter before pagination, preserving branch scope and binding search safely',()=>{const q=applyPharmacyHistoryFilters(db('pharmacy_sales').where({branchid:2}),{search:'DC20',statuses:['completed'],paymentMethod:'cash',dateFrom:'2026-10-01',dateTo:'2026-10-26',minTotal:0,maxTotal:100}).limit(10).offset(10).toSQL();expect(q.sql).toContain('`branchid` = ?');expect(q.sql).toContain('`receipt_number` like ? or `customer_name` like ?');expect(q.bindings).toEqual([2,'completed','cash','2026-10-01 00:00:00','2026-10-27 00:00:00',0,100,'%DC20%','%DC20%',10,10]);});
 it('includes the whole end date and crosses month/year boundaries',()=>{const q=applyPharmacyHistoryFilters(db('pharmacy_sales'),{dateTo:'2026-12-31'}).toSQL();expect(q.bindings).toEqual(['2027-01-01 00:00:00']);expect(q.sql).toContain('`completed_at` < ?');});
 it.each([{dateFrom:'2026-02-30'},{dateTo:'bad'},{dateFrom:'2026-10-27',dateTo:'2026-10-01'},{statuses:['invalid']},{paymentMethod:'free'},{minTotal:-1},{maxTotal:NaN},{minTotal:1.123},{minTotal:20,maxTotal:10}])('rejects malformed or inconsistent filters %j',filters=>expect(()=>validatePharmacyHistoryFilters(filters)).toThrow());
 it('supports zero and decimal amount bounds, split and credit methods',()=>{expect(()=>validatePharmacyHistoryFilters({minTotal:0,maxTotal:40.5,paymentMethod:'split'})).not.toThrow();expect(()=>validatePharmacyHistoryFilters({paymentMethod:'credit'})).not.toThrow();});
 it('retains the existing reversal-type filter',()=>{const q=applyPharmacyHistoryFilters(db('pharmacy_sales'),{reversalType:'refund',statuses:['refunded']}).toSQL();expect(q.bindings).toEqual(['refunded','refund']);});
});

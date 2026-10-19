import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../settings/companyProfile', () => ({ getAllCompanyProfiles: vi.fn() }));
vi.mock('../../../accountingModule/integrations/BillingAccounting', () => ({ enqueueBillingPayment: vi.fn() }));

import {
     OrganizationInvoiceError,
     allocatePayment,
     buildInvoiceLine,
     computeInvoiceTotals,
     deriveInvoiceStatus,
     formatInvoiceNumber,
     parsePaymentAmountCents,
     servicePaymentStatus,
     toCents,
     CreditServiceRow,
} from './OrganizationInvoiceCalculations';
import { nextInvoiceNumber } from './OrganizationInvoiceService';

const row = (overrides: Partial<CreditServiceRow> = {}): CreditServiceRow => ({
     serviceid: 1,
     billingid: 10,
     patientid: 5,
     patient_name: '  Ama   Mensah ',
     service_name: 'Full Blood Count',
     service_date: '2026-10-19',
     totalpayable: '80.00',
     discount: '0.00',
     amountIncurredDueTax: '0.00',
     outstanding: '80.00',
     ...overrides,
});

describe('invoice numbering', () => {
     it('formats a zero-padded per-year number', () => {
          expect(formatInvoiceNumber(2026, 123)).toBe('INV-2026-000123');
          expect(formatInvoiceNumber(2026, 1234567)).toBe('INV-2026-1234567');
     });

     it('rejects invalid sequences', () => {
          expect(() => formatInvoiceNumber(2026, 0)).toThrow(OrganizationInvoiceError);
          expect(() => formatInvoiceNumber(2026, 1.5)).toThrow(OrganizationInvoiceError);
     });

     it('reserves sequential, unique numbers from a row-locked sequence', async () => {
          const store = new Map<number, number>();
          const lockedReads: number[] = [];
          const trx: any = (table: string) => {
               expect(table).toBe('org_invoice_sequences');
               let year = 0;
               const builder: any = {
                    select: () => builder,
                    where: (criteria: { seq_year: number }) => { year = criteria.seq_year; return builder; },
                    forUpdate: () => { lockedReads.push(year); return builder; },
                    first: async () => (store.has(year) ? { last_value: store.get(year) } : undefined),
                    update: async (values: { last_value: number }) => { store.set(year, values.last_value); return 1; },
               };
               return builder;
          };
          trx.raw = async (sql: string, [year]: number[]) => {
               expect(sql).toMatch(/INSERT IGNORE/);
               if (!store.has(year)) store.set(year, 0);
          };

          const numbers: string[] = [];
          for (let i = 0; i < 3; i++) numbers.push(await nextInvoiceNumber(trx, 2026));
          numbers.push(await nextInvoiceNumber(trx, 2027));

          expect(numbers).toEqual(['INV-2026-000001', 'INV-2026-000002', 'INV-2026-000003', 'INV-2027-000001']);
          expect(new Set(numbers).size).toBe(numbers.length);
          expect(lockedReads).toEqual([2026, 2026, 2026, 2027]);
     });
});

describe('money handling', () => {
     it('converts decimals to integer cents without float drift', () => {
          expect(toCents('80.00')).toBe(8000);
          expect(toCents(0.1 + 0.2)).toBe(30);
          expect(toCents('1.005')).toBe(101);
          expect(toCents(null)).toBe(0);
          expect(() => toCents('abc')).toThrow(OrganizationInvoiceError);
     });

     it('accepts only positive payment amounts with at most two decimals', () => {
          expect(parsePaymentAmountCents('50.25')).toBe(5025);
          expect(parsePaymentAmountCents(160)).toBe(16000);
          for (const bad of ['0', '-5', '1.234', 'abc', '', null, '1e3']) {
               expect(() => parsePaymentAmountCents(bad)).toThrow(OrganizationInvoiceError);
          }
     });
});

describe('invoice totals', () => {
     it('reconciles the illustrative three-line invoice (GHS 160.00)', () => {
          const lines = [
               buildInvoiceLine(row({ serviceid: 1, totalpayable: '80.00', outstanding: '80.00' })),
               buildInvoiceLine(row({ serviceid: 2, service_name: 'Malaria Test', totalpayable: '30.00', outstanding: '30.00' })),
               buildInvoiceLine(row({ serviceid: 3, service_name: 'Other', totalpayable: '50.00', outstanding: '50.00' })),
          ];
          const totals = computeInvoiceTotals(lines);
          expect(totals).toEqual({
               subtotal_cents: 16000, discount_cents: 0, tax_cents: 0, total_cents: 16000, prior_credit_cents: 0, amount_due_cents: 16000,
          });
          expect(lines[0].patient_name).toBe('Ama Mensah');
     });

     it('derives the unit price so price - discount + tax equals the payable', () => {
          // 100.00 list, 10.00 discount, 12.5% tax on 90.00 = 11.25 → payable 101.25
          const line = buildInvoiceLine(row({ totalpayable: '101.25', discount: '10.00', amountIncurredDueTax: '11.25', outstanding: '101.25' }));
          expect(line.unit_price_cents).toBe(10000);
          expect(line.unit_price_cents - line.discount_cents + line.tax_cents).toBe(line.line_total_cents);
     });

     it('bills only the outstanding portion and shows earlier credits', () => {
          const line = buildInvoiceLine(row({ totalpayable: '80.00', outstanding: '60.00' }));
          expect(line.prior_credit_cents).toBe(2000);
          expect(line.amount_due_cents).toBe(6000);
          const totals = computeInvoiceTotals([line]);
          expect(totals.total_cents - totals.prior_credit_cents).toBe(totals.amount_due_cents);
     });

     it('refuses settled or inconsistent services', () => {
          expect(() => buildInvoiceLine(row({ outstanding: '0' }))).toThrow(/no outstanding/);
          expect(() => buildInvoiceLine(row({ outstanding: '90.00' }))).toThrow(/greater than its payable/);
     });
});

describe('payment status and allocation', () => {
     const lines = [
          { line_id: 1, service_id: 11, billing_id: 100, line_remaining_cents: 8000, service_outstanding_cents: 8000 },
          { line_id: 2, service_id: 12, billing_id: 100, line_remaining_cents: 3000, service_outstanding_cents: 3000 },
          { line_id: 3, service_id: 13, billing_id: 200, line_remaining_cents: 5000, service_outstanding_cents: 5000 },
     ];

     it('derives status from money received only', () => {
          expect(deriveInvoiceStatus(16000, 0)).toBe('unpaid');
          expect(deriveInvoiceStatus(16000, 1)).toBe('partially_paid');
          expect(deriveInvoiceStatus(16000, 15999)).toBe('partially_paid');
          expect(deriveInvoiceStatus(16000, 16000)).toBe('paid');
          expect(() => deriveInvoiceStatus(16000, 16001)).toThrow(OrganizationInvoiceError);
          expect(deriveInvoiceStatus(0, 0)).toBe('unpaid');
     });

     it('allocates a partial payment oldest line first', () => {
          expect(allocatePayment(9000, 16000, lines)).toEqual([
               { line_id: 1, service_id: 11, billing_id: 100, amount_cents: 8000 },
               { line_id: 2, service_id: 12, billing_id: 100, amount_cents: 1000 },
          ]);
     });

     it('allocates a full payment across every line and bill', () => {
          const allocations = allocatePayment(16000, 16000, lines);
          expect(allocations.reduce((sum, a) => sum + a.amount_cents, 0)).toBe(16000);
          expect(allocations.map(a => a.amount_cents)).toEqual([8000, 3000, 5000]);
     });

     it('rejects overpayment and payments on a settled invoice', () => {
          expect(() => allocatePayment(16001, 16000, lines)).toThrow(/Overpayments are not accepted/);
          expect(() => allocatePayment(100, 0, lines)).toThrow(/no outstanding balance/);
          expect(() => allocatePayment(0, 16000, lines)).toThrow(OrganizationInvoiceError);
     });

     it('never applies more than a service still owes when it was settled elsewhere', () => {
          const drifted = [{ ...lines[0], service_outstanding_cents: 0 }, lines[1], lines[2]];
          expect(() => allocatePayment(16000, 16000, drifted)).toThrow(/Only 80.00 can be applied/);
          expect(allocatePayment(8000, 16000, drifted).map(a => a.line_id)).toEqual([2, 3]);
     });

     it('mirrors the multi-payment service status rule', () => {
          expect(servicePaymentStatus(0, 8000)).toBe('paid');
          expect(servicePaymentStatus(1000, 7000)).toBe('partial');
          expect(servicePaymentStatus(8000, 0)).toBe('pending');
     });
});

import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../settings/companyProfile', () => ({ getAllCompanyProfiles: vi.fn() }));
vi.mock('../../../accountingModule/integrations/BillingAccounting', () => ({ enqueueBillingPayment: vi.fn() }));

import knexLib from 'knex';
import { OrganizationInvoiceService, toDateOnly } from './OrganizationInvoiceService';

const db = knexLib({ client: 'mysql2' });
const actor = { employeeid: 9, email: 'acc@example.com', role: 'accountant', branch: 1, tenantId: 3 };

describe('OrganizationInvoiceService queries', () => {
     it('selects only uninvoiced, outstanding, non-void credit services of the organization and locks them', () => {
          const sql = (new OrganizationInvoiceService(3) as any)
               .creditServicesQuery(db, 7).whereIn('s.billingid', [1, 2]).forUpdate().toString();
          expect(sql).toContain('`s`.`organizationId` = 7');
          expect(sql).toContain('`s`.`outstanding` > 0');
          expect(sql).toContain('`s`.`voidedat` is null');
          expect(sql).toMatch(/not exists \(select 1 from `org_invoice_lines` as `l` where l\.active_service_id = s\.serviceid\)/);
          expect(sql).toContain('`s`.`billingid` in (1, 2)');
          expect(sql).toMatch(/for update$/);
     });
});

describe('OrganizationInvoiceService validation (before any database access)', () => {
     const service = new OrganizationInvoiceService(3);

     it('requires an organization and at least one bill', async () => {
          await expect(service.generateInvoice(actor, { organizationId: 'x', billingIds: [1] })).rejects.toThrow(/organizationId/);
          await expect(service.generateInvoice(actor, { organizationId: 7, billingIds: [] })).rejects.toThrow(/at least one/);
          await expect(service.generateInvoice(actor, { organizationId: 7, billingIds: ['1; DROP'] })).rejects.toThrow(/billing id/);
     });

     it('rejects a due date before the invoice date', async () => {
          await expect(service.generateInvoice(actor, { organizationId: 7, billingIds: [1], dueDate: '2000-01-01' }))
               .rejects.toThrow(/Due date cannot be before/);
          await expect(service.generateInvoice(actor, { organizationId: 7, billingIds: [1], dueDate: '2026-02-30' }))
               .rejects.toThrow(/not a valid date/);
     });

     it('rejects invalid, future-dated or malformed payments', async () => {
          await expect(service.recordPayment(actor, 1, { amount: '-1', paymentModeId: 1 })).rejects.toThrow(/positive number/);
          await expect(service.recordPayment(actor, 1, { amount: '10.001', paymentModeId: 1 })).rejects.toThrow(/two decimal/);
          await expect(service.recordPayment(actor, 1, { amount: '10', paymentModeId: 0 })).rejects.toThrow(/payment mode/);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          await expect(service.recordPayment(actor, 1, { amount: '10', paymentModeId: 1, paymentDate: toDateOnly(tomorrow) }))
               .rejects.toThrow(/future/);
          await expect(service.recordPayment(actor, 1, { amount: '10', paymentModeId: 1, idempotencyKey: 'bad key!' }))
               .rejects.toThrow(/idempotencyKey/);
     });

     it('requires a reason to void', async () => {
          await expect(service.voidInvoice(actor, 1, '')).rejects.toThrow(/reason is required/);
     });
});

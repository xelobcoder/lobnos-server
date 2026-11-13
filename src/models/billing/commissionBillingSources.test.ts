import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import vm from 'vm';
import ts from 'typescript';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import * as referral from '../referral/clinicianReferralOrganization';
import { resolveCommissionRecipient } from '../commissions/commission-configurations/services/CommissionRecipientPolicy';

function loadModule(path: string, dependencies: Record<string, unknown>) {
     const exports: any = {};
     vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
     }).outputText, { exports, require: (name: string) => dependencies[name] || {}, console, Date });
     return exports;
}

let db: ReturnType<typeof accountingSqlDatabase>['db'];
let Submit: any;
let repository: any;
let policy: 'clinician' | 'organization';
const calculate = vi.fn();

beforeEach(() => {
     policy = 'clinician';
     calculate.mockReset().mockResolvedValue({ reason: 'SUCCESS', final_commission: 7, tracking_id: 1 });
     const fixture = accountingSqlDatabase();
     db = fixture.db;
     fixture.native.exec(`
          CREATE TABLE dboservices(serviceid INTEGER PRIMARY KEY, billingid INTEGER, categoryTrackId INTEGER,
               paidamount NUMERIC, totalpayable NUMERIC, clinicianId INTEGER, organizationId INTEGER,
               serviceCategory TEXT, serviceAddedOn TEXT, isoutsourced INTEGER, outsourceprice NUMERIC, status TEXT,
               trackId INTEGER DEFAULT 1, paymentstatus TEXT DEFAULT 'paid');
          CREATE TABLE clinicianbasicinfo(id INTEGER PRIMARY KEY, organization INTEGER, name TEXT);
          CREATE TABLE clinician_organizations(clinician_id INTEGER, organization_id INTEGER);
          CREATE TABLE commission_tracking(id INTEGER PRIMARY KEY, service_id INTEGER, recipient_type TEXT,
               recipient_id INTEGER, commission_type TEXT DEFAULT 'percentage');
          CREATE TABLE test_panels(id INTEGER PRIMARY KEY, name TEXT);
          CREATE TABLE organization(id INTEGER PRIMARY KEY, name TEXT);
          CREATE TABLE commission_batch_payment_services(id INTEGER PRIMARY KEY, serviceid INTEGER);
          INSERT INTO clinicianbasicinfo VALUES(12, 56, 'Referring clinician');
          INSERT INTO organization VALUES(34, 'Selected organization');
          INSERT INTO test_panels VALUES(1, 'Test');
          INSERT INTO dboservices(serviceid, billingid, categoryTrackId, paidamount, totalpayable, clinicianId,
               organizationId, serviceCategory, serviceAddedOn, isoutsourced, outsourceprice, status)
               VALUES(1, 9, 1, 70, 70, 12, 34, 'GENERAL', '2026-11-13', 0, 0, 'active');
     `);
     const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
     const factory = { createEngine: () => ({ executeCommissionCalculation: calculate }) };
     Submit = loadModule('src/models/billing/billing-new-client-multi.ts', {
          '../../database/KnexConnections': async () => db,
          '../referral/clinicianReferralOrganization': referral,
          '../commissions/commission-configurations': { CommissionServiceFactory: factory, CommissionLogger: logger, logger },
     }).SubmitCustomerBilling;
     const Repo = loadModule('src/models/commissions/CommissionTrackingRepository.ts', {
          '../../database/KnexConnections': async () => db,
          '../../hooks/logger': logger,
          '../application/appsettings/appset': class { async getAllAppSettings() { return { commissionRecipientPolicy: policy }; } },
          './CommissionBatchPaymentServicesRepo': { CommissionBatchPaymentServicesRepo: class {} },
          './commission-configurations/services/CommissionServiceFactory': { CommissionServiceFactory: factory },
          './commission-configurations/services/CommissionRecipientPolicy': { resolveCommissionRecipient },
          '../referral/clinicianReferralOrganization': referral,
     }).CommissionTrackingRepo;
     repository = new Repo(1);
});

afterEach(async () => { await db.destroy(); });

describe('commission billing entry points', () => {
     it.each([1, 2, 3, 4, 6])('passes persisted source %i and both selected parties through automatic and bulk calculation', async source => {
          await db('dboservices').update({ categoryTrackId: source });
          await Submit.triggerCommissionCalculation(1, 9);
          expect(calculate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
               service_id: 1, billing_source: source, clinician_id: 12, organization_id: 34, clinician_organization_id: 56,
          }));
          calculate.mockClear();
          expect(await repository.calculateCommissionDue([1])).toBe(1);
          expect(calculate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
               service_id: 1, billing_source: source, clinician_id: 12, organization_id: 34, clinician_organization_id: 56,
          }));
     });

     it.each([
          [1, 'clinician', 'clinician', 12], [1, 'organization', 'organization', 34],
          [3, 'clinician', 'clinician', 12], [3, 'organization', 'organization', 34],
          [4, 'clinician', 'clinician', 12], [4, 'organization', 'organization', 34],
          [2, 'clinician', 'organization', 34], [2, 'organization', 'organization', 34],
          [6, 'clinician', 'clinician', 12], [6, 'organization', 'clinician', 12],
     ] as const)('validates manual source %i under policy %s against %s %i', async (source, preference, type, id) => {
          policy = preference;
          await db('dboservices').update({ categoryTrackId: source });
          expect(await repository.getUntrackedServices(type, id)).toEqual([expect.objectContaining({ commission_recipient_type: type, commission_recipient_id: id })]);
          expect(await repository.getUntrackedServices(type === 'clinician' ? 'organization' : 'clinician', type === 'clinician' ? 34 : 12)).toHaveLength(0);
          await expect(repository.insertUntrackedService(1, type, id)).resolves.toMatchObject({ reason: 'SUCCESS' });
          expect(calculate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
               billing_source: source, clinician_id: 12, organization_id: 34,
          }));
          calculate.mockClear();
          await expect(repository.insertUntrackedService(1, type === 'clinician' ? 'organization' : 'clinician', type === 'clinician' ? 34 : 12))
               .rejects.toThrow('Selected recipient does not match');
          expect(calculate).not.toHaveBeenCalled();
     });

     it('skips automatic calculation when no referring party is selected', async () => {
          await db('dboservices').update({ clinicianId: null, organizationId: null });
          await Submit.triggerCommissionCalculation(1, 9);
          expect(calculate).not.toHaveBeenCalled();
     });

     it('preserves existing tracked commissions during billing retries', async () => {
          await db('commission_tracking').insert({ id: 1, service_id: 1 });
          await Submit.triggerCommissionCalculation(1, 9);
          expect(calculate).not.toHaveBeenCalled();
     });

     it.each(['GENERAL', 'PHIS', 'NHIS', 'ORGANIZATION', 'CLINICIAN_SPECIAL_BILLING'])('shows recorded %s commission under its saved recipient', async serviceCategory => {
          policy = 'clinician';
          await db('dboservices').update({ serviceCategory });
          await db('commission_tracking').insert({ id: 1, service_id: 1, recipient_type: 'organization', recipient_id: 34 });
          expect(await repository.getCommissionTrackingByType('organization', 1, 20, 34)).toHaveLength(1);
          expect(await repository.getCommissionTrackingByType('clinician', 1, 20, 12)).toHaveLength(0);
          expect(await repository.getUntrackedServices('clinician', 12)).toHaveLength(0);
     });
});

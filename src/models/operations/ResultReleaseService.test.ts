import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../application/appsettings/result-settings/resultSettings', () => ({ default: { getResultEntrySettings: vi.fn() } }));
import KnexConnection from '../../database/KnexConnections';
import ResultSettings from '../application/appsettings/result-settings/resultSettings';
import { getResultReleaseWorkflow, ResultReleaseService } from './ResultReleaseService';
import { captureReportRevision, assertResultFormallyReleased } from './ResultReleaseGuard';
import { clinicalReportHash, readReportSnapshot } from '../result/LaboratoryReportVersions';

let fixture: ReturnType<typeof accountingSqlDatabase>;
let settings: any;
const actor = { tenantId: 123456, employeeid: 9, role: 'scientist' };
const report = { records: [{ fieldid: 1, field: 'Hemoglobin', value: '145', units: 'g/L' }] };
beforeEach(() => {
    fixture = accountingSqlDatabase();
    fixture.native.exec(`
        CREATE TABLE test_ascension(id INTEGER PRIMARY KEY, resultEntryEnd TEXT, testid INTEGER DEFAULT 3);
        CREATE TABLE testcreationrules(id INTEGER PRIMARY KEY,testid INTEGER,linearity_enabled BOOLEAN,linearity_lower REAL,linearity_upper REAL,name TEXT,units TEXT);
        CREATE TABLE dbotestresultapproval(ascensionid INTEGER PRIMARY KEY, approval_revision INTEGER, approvedBy TEXT, minvalidation INTEGER, maxvalidation INTEGER, isapproved INTEGER, requires_revalidation INTEGER);
        CREATE TABLE test_results(ascensionid INTEGER, employeeid INTEGER);
        CREATE TABLE resultsettings(id INTEGER, resultsEntrySettings TEXT);
        CREATE TABLE lab_critical_events(ascensionid INTEGER, resolved_at TEXT);
        CREATE TABLE lab_result_manager_approval_events(id INTEGER PRIMARY KEY, ascensionid INTEGER, revision INTEGER, employeeid INTEGER, reason TEXT, created_at TEXT, UNIQUE(ascensionid, revision));
        CREATE TABLE lab_result_release_events(id INTEGER PRIMARY KEY, ascensionid INTEGER, revision INTEGER, report_version_id INTEGER, employeeid INTEGER, signer_name TEXT, signature_hash TEXT, reason TEXT, created_at TEXT, UNIQUE(ascensionid, revision));
        CREATE TABLE lab_report_versions(id INTEGER PRIMARY KEY, ascensionid INTEGER, revision INTEGER, version_number INTEGER, snapshot TEXT, snapshot_hash TEXT, recorded_at TEXT, reason TEXT, signed_by INTEGER, signer_name TEXT, changes TEXT);
        INSERT INTO test_ascension(id,resultEntryEnd) VALUES (1,'2026-11-20');
        INSERT INTO dbotestresultapproval VALUES (1,0,'7,8',2,3,1,0);
        INSERT INTO test_results VALUES (1,5);
        INSERT INTO resultsettings VALUES (1,'{}');
    `);
    settings = { staffQualifiedToReleaseResult: [9], staffQualifiedToValidationResult: [7,8], allowResultAuthorToRelease: false };
    vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
    vi.mocked(ResultSettings.getResultEntrySettings).mockImplementation(async () => settings);
});
afterEach(async () => fixture.db.destroy());
const workflow = (user = actor) => getResultReleaseWorkflow(fixture.db, actor.tenantId, 1, user);
const release = (user = actor, revision = 0, contents = report, hash = clinicalReportHash(contents)) =>
    new ResultReleaseService(actor.tenantId).signAndRelease(1, user, revision, contents, hash, 'QA signer', 'Reviewed synthetic report');

describe('result release authorization', () => {
    it('lets a selected scientist sign after a different manager approves', async () => {
        settings.resultReleasePolicy = 'selected_staff';
        settings.requireManagerApprovalBeforeRelease = true;
        await new ResultReleaseService(actor.tenantId).approveByManager(1, { ...actor, employeeid: 12, role: 'manager' }, 0, 'Manager reviewed');
        await release();
        expect(await fixture.db('lab_result_release_events').first()).toMatchObject({employeeid: 9});
        expect(await fixture.db('lab_result_manager_approval_events').first()).toMatchObject({employeeid: 12});
    });
    it('enforces managers-only mode even for a scientist in the selected list', async () => {
        settings.resultReleasePolicy = 'managers_only';
        expect((await workflow()).canRelease).toBe(false);
        await expect(release()).rejects.toMatchObject({statusCode: 403});
        const manager = {...actor, employeeid: 12, role: 'manager'};
        expect((await workflow(manager)).canRelease).toBe(true);
        await release(manager);
        expect(await fixture.db('lab_result_release_events').first()).toMatchObject({employeeid: 12});
    });
    it('allows managers to release in selected-staff mode without adding them to the scientist list', async () => {
        settings.resultReleasePolicy = 'selected_staff';
        const manager = {...actor, employeeid: 12, role: 'manager'};
        expect((await workflow(manager)).canRelease).toBe(true);
        await expect(release(manager)).resolves.toMatchObject({released:true});
    });
    it.each(['admin','manager','super-admin'])('allows %s to sign a result they entered while scientist self-release is disabled', async role => {
        settings.allowResultAuthorToRelease = false;
        settings.staffQualifiedToReleaseResult = [];
        settings.staffQualifiedToValidationResult = [];
        await fixture.db('test_results').insert({ascensionid:1,employeeid:9});
        const supervisor = {...actor,role};
        expect((await workflow(supervisor)).canRelease).toBe(true);
        await expect(release(supervisor)).resolves.toMatchObject({released:true});
    });
    it.each(['admin','manager'])('still enforces validation and configured validator separation for %s', async role => {
        const supervisor = {...actor,employeeid:7,role};
        settings.requireDifferentReleaserFromValidator = true;
        const status = await workflow(supervisor);
        expect(status.canRelease).toBe(false);
        expect(status.releaseBlockedReason).toContain('did not validate');
        await expect(release(supervisor)).rejects.toMatchObject({statusCode:403});
    });
    it('keeps a fully validated result unavailable for printing until explicitly released', async () => {
        expect((await workflow()).canRelease).toBe(true);
        await expect(captureReportRevision(fixture.db, 1)).rejects.toMatchObject({ code: 'RESULT_NOT_RELEASED' });
        await expect(assertResultFormallyReleased(fixture.db,1,0)).rejects.toMatchObject({code:'RESULT_NOT_RELEASED'});
        await release();
        await expect(assertResultFormallyReleased(fixture.db,1,0)).resolves.toBeUndefined();
        expect(await captureReportRevision(fixture.db, 1)).toBe(0);
        expect((await workflow()).released).toBe(true);
        const event = await fixture.db('lab_result_release_events').first();
        expect(event).toMatchObject({ employeeid: 9, revision: 0, signature_hash: clinicalReportHash(report) });
    });
    it('requires manager approval only when enabled', async () => {
        settings.requireManagerApprovalBeforeRelease = true;
        expect((await workflow()).canRelease).toBe(false);
        await expect(release()).rejects.toThrow('Manager approval');
        await expect(new ResultReleaseService(actor.tenantId).approveByManager(1, actor, 0, 'reviewed')).rejects.toMatchObject({statusCode:403});
        await new ResultReleaseService(actor.tenantId).approveByManager(1, { ...actor, role: 'manager' }, 0, 'reviewed');
        await expect(release()).resolves.toMatchObject({ released:true });
    });
    it('rejects self-validation when another validator is required', async () => {
        settings.requireDifferentValidatorFromResultAuthor = true;
        await fixture.db('test_results').insert({ ascensionid:1, employeeid:7 });
        expect((await workflow()).differentValidatorSatisfied).toBe(false);
        await expect(release()).rejects.toThrow('different validator');
    });
    it.each([false,true])('result author release follows configuration %s, including multiple authors', async allowed => {
        settings.allowResultAuthorToRelease = allowed;
        await fixture.db('test_results').insert({ ascensionid:1, employeeid:9 });
        expect((await workflow()).canRelease).toBe(allowed);
        if (allowed) await expect(release()).resolves.toMatchObject({ released:true });
        else await expect(release()).rejects.toMatchObject({statusCode:403});
    });
    it.each([false,true])('validator release follows optional separation setting %s', async separate => {
        settings.requireDifferentReleaserFromValidator = separate;
        settings.staffQualifiedToReleaseResult = [7];
        const validator = {...actor, employeeid:7};
        expect((await workflow(validator)).canRelease).toBe(!separate);
        if(separate) await expect(release(validator)).rejects.toMatchObject({statusCode:403});
        else await expect(release(validator)).resolves.toMatchObject({released:true});
    });
    it('rejects unauthorized releasers and another facility', async () => {
        await expect(release({...actor,employeeid:11})).rejects.toMatchObject({statusCode:403});
        await expect(release({...actor,tenantId:999999})).rejects.toMatchObject({statusCode:403});
    });
    it('rejects incomplete validation, duplicate validator counts and a stale reviewed revision', async () => {
        await fixture.db('dbotestresultapproval').update({approvedBy:'7,7',isapproved:0});
        await expect(release()).rejects.toThrow('validation');
        await fixture.db('dbotestresultapproval').update({approvedBy:'7,8',isapproved:1});
        await expect(release(actor,1)).rejects.toThrow('changed');
        await expect(release(actor,0,report,'0'.repeat(64))).rejects.toThrow('changed');
    });
    it('invalidates release after amendments and preserves the original signed snapshot', async () => {
        await release();
        const original = await fixture.db('lab_report_versions').first();
        await fixture.db('dbotestresultapproval').update({approval_revision:1,requires_revalidation:1,isapproved:0});
        await expect(captureReportRevision(fixture.db,1)).rejects.toThrow('validation');
        await fixture.db('dbotestresultapproval').update({requires_revalidation:0,isapproved:1});
        await expect(captureReportRevision(fixture.db,1)).rejects.toMatchObject({code:'RESULT_NOT_RELEASED'});
        const amended={records:[{...report.records[0],value:'146'}]};
        await release(actor,1,amended);
        expect(readReportSnapshot(await fixture.db('lab_report_versions').where({id:original.id}).first())).toEqual(report);
        expect(await fixture.db('lab_result_release_events')).toHaveLength(2);
    });
});

it('blocks release when a numeric measurement is outside its analytical range',async()=>{
 fixture.native.exec(`ALTER TABLE test_results ADD COLUMN testid INTEGER DEFAULT 3; ALTER TABLE test_results ADD COLUMN fieldid INTEGER DEFAULT 1; ALTER TABLE test_results ADD COLUMN value TEXT DEFAULT '145'; INSERT INTO testcreationrules VALUES(1,3,1,0,100,'Hemoglobin','g/L');`);
 await expect(release()).rejects.toMatchObject({code:'LINEARITY_CHECK_BLOCKED',statusCode:409});
 expect(await fixture.db('lab_result_release_events')).toHaveLength(0);
 expect(await fixture.db('lab_report_versions')).toHaveLength(0);
});

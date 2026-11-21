import {beforeEach,afterEach,expect,it} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
import {EConsentService,ensureConsentSchema,assertPatientConsent,recordCollectionConsents} from './EConsent';
let fixture:ReturnType<typeof accountingSqlDatabase>,service:EConsentService;
const actor={employeeid:7,tenantId:123456,branch:1,role:'admin'};
beforeEach(async()=>{fixture=accountingSqlDatabase();fixture.native.exec(`CREATE TABLE resultsettings(id INTEGER PRIMARY KEY,resultsEntrySettings TEXT);INSERT INTO resultsettings VALUES(1,'{"electronicConsentMode":"required"}');CREATE TABLE new_patients(patientid INTEGER PRIMARY KEY,firstname TEXT,lastname TEXT,middlename TEXT,fullpatientid TEXT,age INTEGER,agetype TEXT);INSERT INTO new_patients VALUES(1,'QA','Child',NULL,'QA-1',10,'years');INSERT INTO new_patients VALUES(2,'QA','Adult',NULL,'QA-2',30,'years');CREATE TABLE billing(billingid INTEGER PRIMARY KEY,patientid INTEGER,branchid INTEGER);INSERT INTO billing VALUES(1,1,1),(2,2,2);CREATE TABLE test_panels(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO test_panels VALUES(3,'QA Test');CREATE TABLE test_ascension(id INTEGER PRIMARY KEY,testid INTEGER,billingid INTEGER);INSERT INTO test_ascension VALUES(5,3,1),(6,3,2);`);await ensureConsentSchema(fixture.db);service=new EConsentService(fixture.db,actor);});
afterEach(async()=>fixture.db.destroy());
const payload=(template_id:number,key='qa-consent-request-0001')=>({template_id,capture_key:key,signer_name:'QA Parent',signer_role:'guardian',relationship:'Mother',identity_method:'Guardian identity and relationship checked',decision:'agreed',confirmed:true,witnessed:true});
it('retains the signed wording after new versions, supports guardian decisions and idempotent capture',async()=>{
 const template=await service.publish({kind:'registration',title:'QA Registration',body:'Synthetic wording for a witnessed registration consent decision.',required:true});
 const first=await service.capture(1,payload(template.id));const retry=await service.capture(1,payload(template.id));expect(retry.id).toBe(first.id);expect(await fixture.db('patient_consents')).toHaveLength(1);
 await service.publish({kind:'registration',title:'QA Registration',body:'Updated synthetic wording: a new reviewed version for registration consent.',required:true});
 const record=await fixture.db('patient_consents').first();expect(JSON.parse(record.form_snapshot).body).toContain('Synthetic wording');expect(JSON.parse(record.form_snapshot).version).toBe(1);expect((await service.load(1)).templates[0].version).toBe(2);
});
it('requires general and procedure decisions and blocks again after withdrawal without deleting the signature',async()=>{
 const general=await service.publish({kind:'registration',title:'QA General',body:'Synthetic general consent wording for laboratory registration.',required:true});const procedure=await service.publish({kind:'procedure',testid:3,title:'QA Procedure',body:'Synthetic procedure consent wording for this ordered laboratory test.',required:true});
 await expect(fixture.db.transaction(trx=>assertPatientConsent(trx,1,5))).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 await service.capture(1,payload(general.id));await expect(fixture.db.transaction(trx=>assertPatientConsent(trx,1,5))).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 const specific=await service.capture(1,{...payload(procedure.id,'qa-consent-request-0002'),ascensionid:5});await fixture.db.transaction(trx=>assertPatientConsent(trx,1,5));
 await service.withdraw(1,specific.id,'Parent requested withdrawal');await expect(fixture.db.transaction(trx=>assertPatientConsent(trx,1,5))).rejects.toMatchObject({code:'CONSENT_REQUIRED'});expect(await fixture.db('patient_consents').where({id:specific.id}).first()).toBeTruthy();expect((await service.load(1)).records[0].status).toBe('withdrawn');
});
it('rejects unconfirmed, minor self-signing, foreign branch, stale template and unauthorized wording updates',async()=>{
 const template=await service.publish({kind:'procedure',title:'QA Procedure',body:'Synthetic procedure wording for the consent authorization tests.'});
 await expect(service.capture(1,{...payload(template.id),ascensionid:6})).rejects.toMatchObject({statusCode:403});
 await expect(service.capture(1,{...payload(template.id),ascensionid:5,signer_role:'patient'})).rejects.toThrow('guardian');
 await expect(service.capture(1,{...payload(template.id),ascensionid:5,witnessed:false})).rejects.toThrow('Confirm');
 const staff=new EConsentService(fixture.db,{...actor,role:'receptionist'});await expect(staff.publish({})).rejects.toMatchObject({statusCode:403});
 const refusal=await service.capture(1,{...payload(template.id),ascensionid:5,decision:'declined'});expect(refusal.decision).toBe('declined');
});

it('a changed signed snapshot cannot satisfy a required consent policy',async()=>{
 const template=await service.publish({kind:'registration',title:'QA Required',body:'Synthetic consent content whose immutable snapshot must remain verifiable.',required:true});
 const record=await service.capture(1,payload(template.id));await fixture.db('patient_consents').where({id:record.id}).update({form_snapshot:JSON.stringify({body:'Changed'})});
 await expect(fixture.db.transaction(trx=>assertPatientConsent(trx,1,5))).rejects.toMatchObject({code:'CONSENT_REQUIRED'});expect((await service.load(1)).records[0].integrityValid).toBe(false);
});

it('optional and disabled consent policies do not impose collection or release holds',async()=>{
 for(const mode of ['optional','off']){await fixture.db('resultsettings').where({id:1}).update({resultsEntrySettings:JSON.stringify({electronicConsentMode:mode})});await fixture.db.transaction(trx=>assertPatientConsent(trx,1,5));}
});

it('one collection confirmation records general and procedure consent atomically, with verbal attestation and no repeated signature typing',async()=>{
 const general=await service.publish({kind:'registration',title:'QA General',body:'Synthetic general consent wording reviewed during sample collection.',required:true});const procedure=await service.publish({kind:'procedure',testid:3,title:'QA Procedure',body:'Synthetic procedure consent wording reviewed during sample collection.',required:true});
 const consent={patientid:1,billingid:1,confirmed:true,signer_role:'guardian',guardian_name:'QA Parent',relationship:'Mother',capture_key:'qa-inline-consent-0001',template_ids:[general.id,procedure.id]};
 await fixture.db.transaction(trx=>recordCollectionConsents(trx,actor,1,[5],consent));await fixture.db.transaction(trx=>assertPatientConsent(trx,1,5));
 const records=await fixture.db('patient_consents');expect(records).toHaveLength(2);expect(JSON.parse(records[0].form_snapshot).signature.capture_method).toBe('verbal_witnessed');
 await fixture.db.transaction(trx=>recordCollectionConsents(trx,actor,1,[5],consent));expect(await fixture.db('patient_consents')).toHaveLength(2);
});
it('collection cannot silently capture wording that changed after it was displayed',async()=>{
 const first=await service.publish({kind:'registration',title:'QA General',body:'The initial synthetic consent wording reviewed by the patient.'});await service.publish({kind:'registration',title:'QA General',body:'A new version of the synthetic consent wording not yet reviewed.'});
 await expect(fixture.db.transaction(trx=>recordCollectionConsents(trx,actor,1,[5],{patientid:1,billingid:1,confirmed:true,signer_role:'guardian',guardian_name:'QA Parent',capture_key:'qa-inline-stale-000001',template_ids:[first.id]}))).rejects.toMatchObject({statusCode:409});expect(await fixture.db('patient_consents')).toHaveLength(0);
});

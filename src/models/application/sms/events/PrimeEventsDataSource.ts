import KnexConnection from "../../../../database/KnexConnections";
import ClinicianClass from "../../../clincians/clinicianClass";
import Organization from "../../../organization/organization";
import Registration from "../../../registration/registration";
import { getAllCompanyProfiles } from "../../../settings/companyProfile";
import { SmsService } from "../../integrations/Arkesel";
import { SmsMessageParser } from "../PrimeSms/SmsMessageParser";
import { PrimesmsEventsRepository } from "./PrimesmsEventsRepository";

export class PrimeEventsSMSDataSource {

     private tenantId: number;
     private repo: PrimesmsEventsRepository;
     private parser: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.repo = new PrimesmsEventsRepository(tenantId);
     }

     async isEventActive(eventCode: string): Promise<boolean> {
          const event = await this.repo.findByCode(eventCode);
          if (!event || typeof (event as any).active === 'undefined') return false;
          return (event as any).active === 1 || (event as any).active === true;
     }


     async sendSMSMessage(smsconstent: string, phonee164: string, eventCode?: string, refId?: string | number) {
          const sms = await new SmsService().sendSms([phonee164], smsconstent);
          console.log('SMS sent:', sms);
          if (sms && sms.status === 'success' && Array.isArray(sms.data) && sms.data[0]) {

               await this.logSentSmsJob({
                    smsconstent,
                    phonee164,
                    arkeselResponse: sms,
                    eventCode,
                    refId
               });
          }
     }


     private async logSentSmsJob({ smsconstent, phonee164, arkeselResponse, eventCode, refId }: {
          smsconstent: string,
          phonee164: string,
          arkeselResponse: any,
          eventCode?: string,
          refId?: string | number
     }) {
          // Import repositories dynamically to avoid circular dependencies
          const { PrimeSmsJobsRepo } = await import('../repositories/PrimeSmsJobsRepo');
          const { PrimeSmsJobRecipientsRepo } = await import('../repositories/PrimeSmsJobRecipientsRepo');


          const jobsRepo = new PrimeSmsJobsRepo(this.tenantId);
          const recipientsRepo = new PrimeSmsJobRecipientsRepo(this.tenantId);

          let category: 'patient' | 'clinician' | 'organization' = 'patient';
          if (eventCode) {
               try {
                    const { EVENTS } = await import('./EventsRepository');
                    const found = EVENTS.find(e => e.code === eventCode);
                    if (found && found.category) category = found.category;
               } catch {
                    console.error('Error finding event category');
               }
          }

          // Use transaction for both job and recipient creation
          const connection = await KnexConnection(this.tenantId);
          await connection.transaction(async (trx: any) => {
               const jobId = await jobsRepo.create({
                    templateid: null,
                    custombody: smsconstent,
                    category,
                    recipientscope: 'single',
                    targetids: null,
                    sendtype: 'immediate',
                    scheduledat: null,
                    status: 'sent',
                    createdby: 0,
               }, trx);

               const arkeselData = arkeselResponse.data[0];
               let refidNum: number | null = null;
               if (typeof refId === 'number') refidNum = refId;
               else if (typeof refId === 'string' && /^\d+$/.test(refId)) refidNum = parseInt(refId, 10);

               await trx('primesmsjobrecipients').insert({
                    jobid: jobId,
                    phonee164,
                    personalizedbody: smsconstent,
                    deliverystatus: 'sent',
                    messageid: arkeselData.id,
                    refid: refidNum,
                    sentat: new Date(),
               });
          });
     }

     async paymentConfirmationEvent(tenantId: number, billingid: number): Promise<{ smsconstent: string, phonee164: string } | undefined> {
          const isActive = await this.isEventActive('PAYMENT_CONFIRMATION_SMS');
          if (!isActive) return;
          const query = `
            SELECT b.*, p.*
            FROM billing b
            JOIN new_patients p ON b.patientid = p.patientid
            WHERE b.billingid = ?
        `;
          const connection = await KnexConnection(tenantId);
          const [result] = await connection.raw(query, [billingid]);
          if (!result || !result[0]) return;

          const hxQuery = `
            SELECT * FROM billinghx  AS bhx
            INNER JOIN paymentmodes  ON bhx.PaymentMode = paymentmodes.KeyID
            WHERE billingid = ? ORDER BY bhx.KeyID DESC`;
          let billinghx = [];
          try {
               const [hxResult] = await connection.raw(hxQuery, [billingid]);
               billinghx = Array.isArray(hxResult) ? hxResult : [];
          } catch (e) { }

          let paymentSummary = '';
          if (billinghx.length > 0) {
               paymentSummary = billinghx.map(hx => `${hx.PaymentMode}: ${hx.Amount}`).join(', ');
          }

          const data = { ...result[0], paymentSummary };
          const event = await this.repo.findByCode('PAYMENT_CONFIRMATION_SMS');
          if (!event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
          const smscontent = parsedContent + (paymentSummary ? `\n\nPayment(s): ${paymentSummary}` : '');
          const phonee164 = result[0].mobile_number ? result[0].mobile_number.replace(/^\+/, '') : '';
          const refid = result[0].patientid;
          await this.sendSMSMessage(smscontent, phonee164, 'PAYMENT_CONFIRMATION_SMS', refid);
     }


     async parsedEventTemplate(tenantId: number, data: Object, event: string) {
          const companyInfo = await getAllCompanyProfiles(tenantId);
          if (!data || !companyInfo) return;
          const merged = { ...data, ...companyInfo, companyname: companyInfo.name, companyphonenumber: companyInfo.phonenumber };
          return SmsMessageParser.parse(event, merged);
     }

     async patientRegistrationEvent(tenantId: number, patientid: number): Promise<{ smsconstent: string, phonee164: string } | undefined> {
          const isActive = await this.isEventActive('PATIENT_REGISTRATION_SMS');
          if (!isActive) return;
          // Get patient basic data
          const data = await new Registration().getPatientBasicData(tenantId, patientid);
          const event = await this.repo.findByCode('PATIENT_REGISTRATION_SMS');
          if (!data || !event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
          // Try to find a phone number property for patient registration
          let phonee164 = '';
          if ('phone' in data && data.phone) phonee164 = String(data.phone).replace(/^\+/, '');
          else if ('phonenumber' in data && data.phonenumber) phonee164 = String(data.phonenumber).replace(/^\+/, '');
          else if ('mobile' in data && data.mobile) phonee164 = String(data.mobile).replace(/^\+/, '');
          else if ('mobile_number' in data && data.mobile_number) phonee164 = String(data.mobile_number).replace(/^\+/, '');
          await this.sendSMSMessage(parsedContent, phonee164, 'PATIENT_REGISTRATION_SMS', patientid);
     }


     async patientTransactionEventData(tenantId: number, billingid: number): Promise<{ smsconstent: string, phonee164: string } | undefined> {
          const isActive = await this.isEventActive('PATIENT_BILLING_SMS');
          if (!isActive) return;

          const query = `
               SELECT b.*,p.*
               FROM billing b
               JOIN new_patients p ON b.patientid = p.patientid
               WHERE b.billingid = ?
          `;

          const connection = await KnexConnection(tenantId);
          const [result] = await connection.raw(query, [billingid]);
          if (!result || !result[0]) return;
          const event = await this.repo.findByCode('PATIENT_BILLING_SMS');
          if (!event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, result[0], event.content);
          const phonee164 = result[0].mobile_number ? result[0].mobile_number.replace(/^\+/, '') : '';
          await this.sendSMSMessage(parsedContent, phonee164, 'PATIENT_BILLING_SMS', result[0].patientid);
     }


     async testAscensionEventDataAllDone(tenantId: number, billingid: number): Promise<{ smsconstent: string, phonee164: string } | undefined> {
          const isActive = await this.isEventActive('PATIENT_RESULT_READY');
          if (!isActive) return;
          // Get count of unapproved ascensions
          const query_verified = `
             SELECT COUNT(*) AS counter FROM test_ascension AS ta 
             INNER JOIN  dbotestresultapproval AS dta
                ON ta.id = dta.ascensionid
             WHERE isapproved = 0 AND ta.billingid = ?
          `;

          // Get billing summary
          const billing_query = `
             SELECT * FROM billing AS b 
             INNER JOIN new_patients AS p ON p.patientid = b.patientid WHERE billingid = ?
          `;

          // Get count of tests performed for this billing
          const test_count_query = `
             SELECT COUNT(*) AS test_count FROM test_ascension WHERE billingid = ?
          `;

          const connection = await KnexConnection(tenantId);
          const [ascensionResult] = await connection.raw(query_verified, [billingid]);
          const [billingResult] = await connection.raw(billing_query, [billingid]);
          const [testCountResult] = await connection.raw(test_count_query, [billingid]);
          const hasUnapproved = Array.isArray(ascensionResult) && ascensionResult.length > 0 && ascensionResult[0].counter > 0;
          if (!hasUnapproved) return;
          const data = { ...billingResult[0], test_count: testCountResult[0]?.test_count || 0 };
          const event = await this.repo.findByCode('PATIENT_RESULT_READY');
          if (!event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
          const phonee164 = data.mobile_number ? data.mobile_number.replace(/^\+/, '') : '';
          await this.sendSMSMessage(parsedContent, phonee164, 'PATIENT_RESULT_READY', data.patientid);
     }



     async sampleRejectionEvent(tenantId: number, ascensionid: number): Promise<{ smsconstent: string, phonee164: string } | undefined> {
          const isActive = await this.isEventActive('SAMPLE_REJECTION_SMS');
          if (!isActive) return;

          const event = await this.repo.findByCode('SAMPLE_REJECTION_SMS');
          const connection = await KnexConnection(tenantId)
          let sample = await connection('samplestatus')
               .leftJoin('test_ascension', 'samplestatus.ascensionid', 'test_ascension.id')
               .leftJoin('test_panels', 'test_ascension.testid', 'test_panels.id')
               .leftJoin('billing', 'test_ascension.billingid', 'billing.billingid')
               .leftJoin('new_patients', 'billing.patientid', 'new_patients.patientid')
               .where({ ascensionid })
               .select('samplestatus.*', 'test_panels.name as testname', 'test_ascension.*', 'billing.*', 'new_patients.*')
               .first();

          if (!sample || !event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, sample, event.content);
          const phonee164 = sample.mobile_number ? sample.mobile_number.replace(/^\+/, '') : '';
          await this.sendSMSMessage(parsedContent, phonee164, 'SAMPLE_REJECTION_SMS', sample.patientid);
     }



     async clinicianRegistrationEvent(tenantId: number, clinicianid: number): Promise<{ smsconstent: string, phonee164: string } | undefined> {
          const isActive = await this.isEventActive('CLINICIAN_REGISTRATION_SMS');
          if (!isActive) return;

          const data = await new ClinicianClass().getClinicianBasicInfo(tenantId, clinicianid);
          const event = await this.repo.findByCode('CLINICIAN_REGISTRATION_SMS');
          if (!data || !Array.isArray(data) || data.length === 0 || !event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data[0], event.content);
          const phonee164 = (data[0].phone) ? String(data[0].phone).replace(/^\+/, '') : '';
          await this.sendSMSMessage(parsedContent, phonee164, 'CLINICIAN_REGISTRATION_SMS', clinicianid);
     }



     async organizationRegistrationEvent(tenantId: number, organizationid: number): Promise<{ smsconstent: string, phonee164: string } | undefined> {
          const isActive = await this.isEventActive('ORGANIZATION_REGISTRATION_SMS');
          if (!isActive) return;

          const data = await new Organization(organizationid).getOrganizationBasic(tenantId);
          const event = await this.repo.findByCode('ORGANIZATION_REGISTRATION_SMS');
          if (!data || !Array.isArray(data) || data.length === 0 || !event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data[0], event.content);
          const phonee164 = data[0].phonenumber ? data[0].phonenumber.replace(/^\+/, '') : '';
          await this.sendSMSMessage(parsedContent, phonee164, 'ORGANIZATION_REGISTRATION_SMS', organizationid);
     }
}
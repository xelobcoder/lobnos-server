import KnexConnection from "../../../../database/KnexConnections";
import ClinicianClass from "../../../clincians/clinicianClass";
import Organization from "../../../organization/organization";
import Registration from "../../../registration/registration";
import { getAllCompanyProfiles } from "../../../settings/companyProfile";
import { SmsMessageParser } from "../PrimeSms/SmsMessageParser";
import { PrimesmsEventsRepository } from "./PrimesmsEventsRepository";
import { validateModuleConfiguration } from "../../../Tenancy/FacilityModules";
import logger from "../../../../hooks/logger";

import { isSmsActive } from '../SmsActivation';

export class PrimeEventsSMSDataSource {

     private tenantId: number;
     private repo: PrimesmsEventsRepository;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.repo = new PrimesmsEventsRepository(tenantId);
     }

     async isEventActive(eventCode: string): Promise<boolean> {
          if (!(await this.isSmsModuleEnabled())) return false;
          const event = await this.repo.findByCode(eventCode);
          if (!event || typeof (event as any).active === 'undefined') return false;
          return (event as any).active === 1 || (event as any).active === true;
     }


     async sendSMSMessage(smsconstent: string, phonee164: string, eventCode: string, refId: string | number, isevent: boolean, createdby: number, sourceKey = ''): Promise<{ status: boolean | string }> {
          if (!(await this.isSmsModuleEnabled())) {
               logger.info('SMS event skipped because the facility module is not activated', { tenantId: this.tenantId, eventCode });
               return { status: false };
          }
          try {
               const { SmsCampaignService } = await import('../SmsCampaignService');
               const { EVENTS } = await import('./EventsRepository');
               await new SmsCampaignService(this.tenantId).enqueueEvent(smsconstent,phonee164,eventCode,Number(refId),createdby,EVENTS.find(event=>event.code===eventCode)?.category || 'patient',sourceKey || (eventCode==='BIRTHDAY_SMS'?new Date().toISOString().slice(0,10):''));
               return {status:'success'};
          } catch (error) {
               logger.error('Unable to queue SMS event',{tenantId:this.tenantId,eventCode,code:(error as any)?.code||'UNKNOWN'});
               return { status: false };
          }
     }

     private async isSmsModuleEnabled(): Promise<boolean> { return isSmsActive(this.tenantId); }



     async paymentConfirmationEvent(tenantId: number, billingid: number, employeeid: number): Promise<{ status: boolean | string } | undefined> {
          try {
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
               } catch (e) {
                    throw e;
               }

               let paymentSummary = '';
               if (billinghx.length > 0) {
                    paymentSummary = billinghx.map(hx => `${hx.PaymentMode}: ${hx.Amount}`).join(', ');
               }

               const data = { ...result[0], paymentSummary };
               const event = await this.repo.findByCode('PAYMENT_CONFIRMATION_SMS');
               if (!event) return;
               const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
               const smscontent = parsedContent + '';
               const phonee164 = result[0].mobile_number ? result[0].mobile_number.replace(/^\+/, '') : '';
               const refid = result[0].patientid;
               return await this.sendSMSMessage(smscontent, phonee164, 'PAYMENT_CONFIRMATION_SMS', refid, true, employeeid,`${billingid}:${JSON.stringify(billinghx)}`);
          } catch (error) {
               console.error('Error in paymentConfirmationEvent:', error);
               throw error;
          }
     }


     async parsedEventTemplate(tenantId: number, data: Object, event: string) {
          const companyInfo = await getAllCompanyProfiles(tenantId);
          if (!data || !companyInfo) return;
          const merged = { ...data, ...companyInfo, companyname: companyInfo.name, companyphonenumber: companyInfo.phonenumber };
          return SmsMessageParser.parse(event, merged);
     }

     async patientRegistrationEvent(tenantId: number, patientid: number, employeeId: number): Promise<{ status: boolean | string } | undefined> {
          const isActive = await this.isEventActive('PATIENT_REGISTRATION_SMS');
          if (!isActive) return;
          const data = await new Registration().getPatientBasicData(tenantId, patientid);
          const event = await this.repo.findByCode('PATIENT_REGISTRATION_SMS');
          if (!data || !event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
          let phonee164 = '';
          if ('phone' in data && data.phone) phonee164 = String(data.phone).replace(/^\+/, '');
          else if ('phonenumber' in data && data.phonenumber) phonee164 = String(data.phonenumber).replace(/^\+/, '');
          else if ('mobile' in data && data.mobile) phonee164 = String(data.mobile).replace(/^\+/, '');
          else if ('mobile_number' in data && data.mobile_number) phonee164 = String(data.mobile_number).replace(/^\+/, '');
          return await this.sendSMSMessage(parsedContent as string, phonee164, 'PATIENT_REGISTRATION_SMS', patientid, true, employeeId);
     }

     async patientBirthDayMessageLogging(tenantId: number, patientid: number, employeeId: number) {
          const isActive = await this.isEventActive('BIRTHDAY_SMS');
          if (!isActive) return;
          const data = await new Registration().getPatientBasicData(tenantId, patientid);
          const event = await this.repo.findByCode('BIRTHDAY_SMS');
          if (!data || !event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
          let phonee164 = '';
          if ('phone' in data && data.phone) phonee164 = String(data.phone).replace(/^\+/, '');
          else if ('phonenumber' in data && data.phonenumber) phonee164 = String(data.phonenumber).replace(/^\+/, '');
          else if ('mobile' in data && data.mobile) phonee164 = String(data.mobile).replace(/^\+/, '');
          else if ('mobile_number' in data && data.mobile_number) phonee164 = String(data.mobile_number).replace(/^\+/, '');
          return await this.sendSMSMessage(parsedContent as string, phonee164, 'BIRTHDAY_SMS', patientid, true, employeeId);
     }


     async patientTransactionEventData(tenantId: number, billingid: number, employeeId: number): Promise<{ status: boolean | string } | undefined> {
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
          return await this.sendSMSMessage(parsedContent as string, phonee164, 'PATIENT_BILLING_SMS', result[0].patientid, true, employeeId,String(result[0].billingid));
     }



     async testAscensionEventDataAllDone(tenantId: number, billingid: number, createdby: number, ignoreAllMustPass: boolean = false, customMessage: string | null = null): Promise<{ status: boolean | string } | undefined> {
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
          if (!ignoreAllMustPass && !hasUnapproved) return;
          // If ignoreAllMustPass is true, always send the message
          const data = { ...billingResult[0], test_count: testCountResult[0]?.test_count || 0 };
          const event = await this.repo.findByCode('PATIENT_RESULT_READY');
          if (!event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data, event.content);
          const phonee164 = data.mobile_number ? data.mobile_number.replace(/^+/, '') : '';
          return await this.sendSMSMessage((customMessage ? customMessage : parsedContent) as string, phonee164, 'PATIENT_RESULT_READY', data.billingid, true, createdby);
     }



     async sampleRejectionEvent(tenantId: number, ascensionid: number, employeeId: number): Promise<{ status: boolean | string } | undefined> {
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
          return await this.sendSMSMessage(parsedContent as string, phonee164, 'SAMPLE_REJECTION_SMS', ascensionid, true, employeeId);
     }



     async clinicianRegistrationEvent(tenantId: number, clinicianid: number, employeeId: number): Promise<{ status: boolean | string } | undefined> {
          const isActive = await this.isEventActive('CLINICIAN_REGISTRATION_SMS');
          if (!isActive) return;

          const data = await new ClinicianClass().getClinicianBasicInfo(tenantId, clinicianid);
          const event = await this.repo.findByCode('CLINICIAN_REGISTRATION_SMS');
          if (!data || !Array.isArray(data) || data.length === 0 || !event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data[0], event.content);
          const phonee164 = (data[0].phone) ? String(data[0].phone).replace(/^\+/, '') : '';
          return await this.sendSMSMessage(parsedContent as string, phonee164, 'CLINICIAN_REGISTRATION_SMS', clinicianid, true, employeeId);
     }



     async organizationRegistrationEvent(tenantId: number, organizationid: number, employeeId: number): Promise<{ status: boolean | string } | undefined> {
          const isActive = await this.isEventActive('ORGANIZATION_REGISTRATION_SMS');
          if (!isActive) return;

          const data = await new Organization(organizationid).getOrganizationBasic(tenantId);
          const event = await this.repo.findByCode('ORGANIZATION_REGISTRATION_SMS');
          if (!data || !Array.isArray(data) || data.length === 0 || !event) return;
          const parsedContent = await this.parsedEventTemplate(tenantId, data[0], event.content);
          const phonee164 = data[0].phonenumber ? data[0].phonenumber.replace(/^\+/, '') : '';
          return await this.sendSMSMessage(parsedContent as string, phonee164, 'ORGANIZATION_REGISTRATION_SMS', organizationid, true, employeeId);
     }

     static async getClientResultReadySentcount(tenantId: number, billingid: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          const result = await connection('primesmsjobrecipients')
               .where({ refid: billingid, eventcode: 'PATIENT_RESULT_READY' })
               .andWhere('deliverystatus', 'sent')
               .count('* as count');
          return Number(result[0]?.count || 0);
     }

     static async getSentSMSEventMessage(tenantId: number, eventCode: string, refid: number) {
          try {
               const connection = await KnexConnection(tenantId);
               return connection('primesmsjobrecipients')
                    .where({ eventcode: eventCode, refid })
                    .andWhere('deliverystatus', 'sent')
                    .select('personalizedbody')
          } catch (error) {
               throw error;
          }
     }
}
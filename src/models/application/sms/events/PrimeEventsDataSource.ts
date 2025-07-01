import KnexConnection from "../../../../database/KnexConnections";
import Registration from "../../../registration/registration";
import { getAllCompanyProfiles } from "../../../settings/companyProfile";
import { SmsMessageParser } from "../PrimeSms/SmsMessageParser";
import { PrimesmsEvent, PrimesmsEventsRepository } from "./PrimesmsEventsRepository";

export class PrimeEventsSMSDataSource {
     private tenantId: number;
     private repo: PrimesmsEventsRepository;
     private parser: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.repo = new PrimesmsEventsRepository(tenantId);
     }

     async parsedEventTemplate(tenantId: number, data: Object, event: string) {
          const companyInfo = await getAllCompanyProfiles(tenantId);
          if (!data || !companyInfo) return;
          const merged = { ...data, ...companyInfo, companyname: companyInfo.name, companyphonenumber: companyInfo.phonenumber };
          return SmsMessageParser.parse(event, merged);
     }
     async patientRegistrationEvent(tenantId: number, patientid: number) {
          const data = await new Registration().getPatientBasicData(tenantId, patientid);
          const event = await this.repo.findByCode('PATIENT_REGISTRATION_SMS');
          if (!data || !event) return;
          return this.parsedEventTemplate(tenantId, data, event.content);
     }

     async patientTransactionEventData(tenantId: number, billingid: number) {
          const query = `
               SELECT b.*,p.*
               FROM billing b
               JOIN new_patients p ON b.patientid = p.patientid
               WHERE b.billingid = ?
          `;
          const connection = await KnexConnection(tenantId);
          const [result] = await connection.raw(query, [billingid]);
          const event = await this.repo.findByCode('PATIENT_BILLING_SMS');
          return this.parsedEventTemplate(tenantId, result[0], event.content);
     }

     async testAscensionEventDataAllDone(tenantId: number, billingid: number) {
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
          return this.parsedEventTemplate(tenantId, data, event.content);
     }


     async sampleRejectionEvent(tenantId: number, ascensionid: number) {
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
          return this.parsedEventTemplate(tenantId, sample, event.content);
     }
}
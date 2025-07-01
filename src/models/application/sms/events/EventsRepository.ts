
import KnexConnection from '../../../../database/KnexConnections';

export interface Event {
     code: string;
     description: string;
     category: 'patient' | 'clinician' | 'organization';
     defaultContent: string;
     placeholders: string[];
}

export const EVENTS: Event[] = [
 
     {
          code: 'PAYMENT_CONFIRMATION_SMS',
          description: 'Payment confirmation SMS event',
          category: 'patient',
          defaultContent: 'Dear {{designation}} {{firstname}} {{middlename}} {{lastname}},\n\nWe have received your payment of {{amount}} for bill ID {{billingid}} on {{payment_date}}.\n\nThank you for choosing {{companyname}}.\n\nBest regards,\n{{companyname}} Team',
          placeholders: [
               'billingid', 'patientid', 'totalTransactionCost', 'totalcost', 'paid', 'payable', 'totalrefunded', 'discount', 'outstanding', 'balance', 'billedon',
               'clientstatus', 'year', 'month', 'day', 'amountIncurredDueTax', 'lastupdated', 'branchid', 'isPromo', 'promoValue', 'promoMethod', 'promoCodeId', 'status',
               'relatedBillingId', 'fullpatientid', 'designation', 'firstname', 'email', 'dob', 'age', 'gender', 'marital_status', 'mobile_number', 'agetype', 'occupation',
               'date', 'activation_status', 'lastname', 'middlename', 'organization', 'contactpointer', 'whatAppcontact', 'name', 'motto', 'phonenumber', 'address',
               'website', 'street', 'alternativenumber', 'companyname', 'amount', 'payment_date', 'payment_method'
          ]
     },
     {
          code: 'PATIENT_REGISTRATION_SMS',
          description: 'Patient registration SMS event',
          category: 'patient',
          defaultContent: 'Dear {{designation}} {{firstname}} {{middlename}} {{lastname}},\n\nWelcome to {{companyname}}! Your registration has been successfully completed. We are delighted to have you as part of our organization.\n\nIf you have any questions or need assistance, please contact us at {{phonenumber}} or visit us at {{address}}.\n\nBest regards,\n{{companyname}} Team',
          placeholders: [
               'patientid', 'fullpatientid', 'designation', 'firstname', 'email', 'dob', 'age', 'gender', 'marital_status', 'mobile_number', 'agetype', 'occupation',
               'date', 'activation_status', 'lastname', 'middlename', 'organization', 'contactpointer', 'whatAppcontact', 'name', 'motto', 'phonenumber', 'address',
               'website', 'street', 'alternativenumber', 'companyname'
          ]
     },
     {
          code: 'PATIENT_BILLING_SMS',
          description: 'Patient billing SMS event',
          category: 'patient',
          defaultContent: 'Dear {{firstname}} {{middlename}} {{lastname}}, your bill (ID: {{billingid}}) of {{totalcost}} has been generated on {{billedon}}. Paid: {{paid}}. Outstanding: {{outstanding}}. Please contact {{companyname}} for details.',
          placeholders: [
               'billingid', 'patientid', 'totalTransactionCost', 'totalcost', 'paid', 'payable', 'totalrefunded', 'discount', 'outstanding', 'balance', 'billedon',
               'clientstatus', 'year', 'month', 'day', 'amountIncurredDueTax', 'lastupdated', 'branchid', 'isPromo', 'promoValue', 'promoMethod', 'promoCodeId', 'status',
               'relatedBillingId', 'fullpatientid', 'designation', 'firstname', 'email', 'dob', 'age', 'gender', 'marital_status', 'mobile_number', 'agetype', 'occupation',
               'date', 'activation_status', 'lastname', 'middlename', 'organization', 'contactpointer', 'whatAppcontact', 'name', 'motto', 'phonenumber', 'address',
               'website', 'street', 'alternativenumber', 'companyname'
          ]
     },
     {
          code: 'PATIENT_RESULT_READY',
          description: 'Patient result ready event',
          category: 'patient',
          defaultContent: 'Dear {{designation}} {{firstname}} {{middlename}} {{lastname}},\n\nWe are pleased to inform you that your test results are now ready at {{companyname}}.\n\nTo access your results or for any inquiries, please contact us at {{companyphonenumber}} or visit our facility.\n\nThank you for choosing {{companyname}}.\n\nBest regards,\n{{companyname}} Team',
          placeholders: [
               'billingid', 'patientid', 'totalTransactionCost', 'totalcost', 'paid', 'payable', 'totalrefunded', 'discount', 'outstanding', 'balance', 'billedon',
               'clientstatus', 'year', 'month', 'day', 'amountIncurredDueTax', 'lastupdated', 'branchid', 'isPromo', 'promoValue', 'promoMethod', 'promoCodeId', 'status',
               'relatedBillingId', 'fullpatientid', 'designation', 'firstname', 'email', 'dob', 'age', 'gender', 'marital_status', 'mobile_number', 'agetype', 'occupation',
               'date', 'activation_status', 'lastname', 'middlename', 'organization', 'contactpointer', 'whatAppcontact', 'test_count'
          ]
     },
     {
          code: 'SAMPLE_REJECTION_SMS',
          description: 'Sample rejection SMS event',
          category: 'patient',
          defaultContent: 'Dear {{designation}} {{firstname}} {{middlename}} {{lastname}},\n\nWe regret to inform you that your sample for {{testname}} could not be processed at {{companyname}}.\n\nReason: {{rejectionmessage}}\n\nIf you have any questions or require further assistance, please contact us.\n\nBest regards,\n{{companyname}} Team',
          placeholders: [
               'keyid', 'date', 'rejectionmessage', 'testid', 'approvalstatus', 'samplemessage', 'phelobotomist', 'ascensionid', 'redraw', 'redrawOrderDate', 'isRedraw',
               'samplevalidatedon', 'validatedby', 'disputedby', 'disputedon', 'disputereason', 'resolution', 'id', 'serviceid', 'billingid', 'month', 'year', 'ascension_date',
               'collectionStartDate', 'collectionEndDate', 'processingStartDate', 'processingEndDate', 'resultEntryStart', 'resultEntryEnd', 'sampleCollectedBy',
               'sampleProcessedBy', 'resultEnteredBy', 'prim_key', 'name', 'category', 'price', 'created_on', 'sample', 'description', 'sample_container', 'unit',
               'qty_required', 'shorttext', 'iscustom', 'patientid', 'totalTransactionCost', 'totalcost', 'paid', 'payable', 'totalrefunded', 'discount', 'outstanding',
               'balance', 'billedon', 'clientstatus', 'day', 'amountIncurredDueTax', 'lastupdated', 'branchid', 'isPromo', 'promoValue', 'promoMethod', 'promoCodeId', 'status',
               'relatedBillingId', 'fullpatientid', 'designation', 'firstname', 'email', 'dob', 'age', 'gender', 'marital_status', 'mobile_number', 'agetype', 'occupation',
               'activation_status', 'lastname', 'middlename', 'organization', 'contactpointer', 'whatAppcontact', 'testname', 'companyname', 'companyphonenumber'
          ]
     },
     {
          code: 'CRITICAL_VALUES_SMS',
          description: 'Critical values SMS event',
          category: 'patient',
          defaultContent: 'Dear {{firstname}} {{middlename}} {{lastname}}, your recent test at {{companyname}} has a critical result. Please contact us immediately.',
          placeholders: ['firstname', 'middlename', 'lastname', 'companyname', 'designation']
     },
     {
          code: 'CLINICIAN_REGISTRATION_SMS',
          description: 'Clinician registration SMS event',
          category: 'clinician',
          defaultContent: 'Dear Dr. {{name}},\n\nWelcome to {{companyname}}! Your registration has been successfully completed.\n\nIf you have any questions or need assistance, please contact us at {{companyphonenumber}} or visit us at {{companyaddress}}.\n\nBest regards,\n{{companyname}} Team',
          placeholders: [
               'id', 'name', 'location', 'address', 'occupation', 'organization', 'updated_on', 'created_on', 'phone', 'email', 'identifier',
               'companyname', 'companyphonenumber', 'companyaddress'
          ]
     },
     {
          code: 'ORGANIZATION_REGISTRATION_SMS',
          description: 'Organization registration SMS event',
          category: 'organization',
          defaultContent: 'Dear {{name}},\n\nWelcome to {{companyname}}! Your organization registration has been successfully completed.\n\nIf you have any questions or need assistance, please contact us at {{companyphonenumber}} or visit us at {{companyaddress}}.\n\nBest regards,\n{{companyname}} Team',
          placeholders: [
               'id', 'name', 'location', 'street', 'mobile', 'address', 'email', 'region', 'gpsmapping', 'website', 'type',
               'companyname', 'companyphonenumber', 'companyaddress', 'referralcode', 'status'
          ]
     },
     {
          code: 'BIRTHDAY_SMS',
          description: 'Birthday greeting SMS event',
          category: 'patient',
          defaultContent: 'Happy Birthday {{designation}}! {{firstname}} {{lastname}}  Wishing you a wonderful year ahead from all of us at {{companyname}}.',
          placeholders: [
               'patientid', 'fullpatientid', 'designation', 'firstname', 'email', 'dob', 'age', 'gender', 'marital_status', 'mobile_number', 'agetype', 'occupation',
               'date', 'activation_status', 'lastname', 'middlename', 'organization', 'contactpointer', 'whatAppcontact', 'name', 'motto', 'phonenumber', 'address',
               'website', 'street', 'alternativenumber', 'companyname'
          ]
     },
     {
          code: 'HOLIDAY_GREETING_SMS',
          description: 'Holiday greeting SMS event',
          category: 'patient',
          defaultContent: 'Season’s greetings, {{designation}} {{firstname}} {{lastname}}! Enjoy your holiday. - {{companyname}}',
          placeholders: [
               'patientid', 'fullpatientid', 'designation', 'firstname', 'email', 'dob', 'age', 'gender', 'marital_status', 'mobile_number', 'agetype', 'occupation',
               'date', 'activation_status', 'lastname', 'middlename', 'organization', 'contactpointer', 'whatAppcontact', 'name', 'motto', 'phonenumber', 'address',
               'website', 'street', 'alternativenumber', 'companyname'
          ]
     }
];

export function findEventByCode(code: string): Event | undefined {
     return EVENTS.find(e => e.code === code);
}

export function isEventValid(code: string): boolean {
     return !!findEventByCode(code);
}

export async function setEventActiveStatus(tenantId: number, code: string, active: boolean): Promise<boolean> {
     const conn = await KnexConnection(tenantId);
     const result = await conn('primesmsevents').where({ code }).update({ active });
     return result > 0;
}
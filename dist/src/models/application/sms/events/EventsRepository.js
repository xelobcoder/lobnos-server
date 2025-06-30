"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setEventActiveStatus = exports.isEventValid = exports.findEventByCode = exports.EVENTS = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
exports.EVENTS = [
    {
        code: 'PATIENT_REGISTRATION_SMS',
        description: 'Patient registration SMS event',
        category: 'patient',
        defaultContent: 'Dear {{firstname}} {{middlename}} {{lastname}}, you have been registered at {{companyname}} as {{designation}}.',
        placeholders: ['firstname', 'middlename', 'lastname', 'companyname', 'designation']
    },
    {
        code: 'PATIENT_BILLING_SMS',
        description: 'Patient billing SMS event',
        category: 'patient',
        defaultContent: 'Dear {{firstname}} {{middlename}} {{lastname}}, your bill (ID: {{billingid}}) of {{totalpayable}} has been generated on {{billedon}}. Paid: {{paid}}. Please contact {{companyname}} for details.',
        placeholders: ['firstname', 'middlename', 'lastname', 'companyname', 'designation', 'totalpayable', 'paid', 'billingid', 'billedon']
    },
    {
        code: 'PATIENT_RESULT_READY',
        description: 'Patient result ready event',
        category: 'patient',
        defaultContent: 'Dear {{firstname}} {{middlename}} {{lastname}}, your test results are ready at {{companyname}}. Please visit or contact us for more information.',
        placeholders: ['firstname', 'middlename', 'lastname', 'companyname', 'designation', 'totalpayable', 'paid', 'billingid', 'billedon']
    },
    {
        code: 'SAMPLE_REJECTION_SMS',
        description: 'Sample rejection SMS event',
        category: 'patient',
        defaultContent: 'Dear {{firstname}} {{middlename}} {{lastname}}, your sample for {{testname}} was rejected at {{companyname}}. Reason: {{rejectionreason}}.',
        placeholders: ['testname', 'companyname', 'rejectionreason']
    },
    {
        code: 'CRITICAL_VALUES_SMS',
        description: 'Critical values SMS event',
        category: 'patient',
        defaultContent: 'Dear {{firstname}} {{middlename}} {{lastname}}, your recent test at {{companyname}} has a critical result. Please contact us immediately.',
        placeholders: ['firstname', 'middlename', 'lastname', 'companyname', 'designation']
    },
    {
        code: 'CLINICIAN_NOTIFICATION_SMS',
        description: 'Clinician notification SMS event',
        category: 'clinician',
        defaultContent: 'Dear Dr. {{clinicianName}}, a new result for {{firstname}} {{middlename}} {{lastname}} is available in your portal.',
        placeholders: ['clinicianName', 'firstname', 'middlename', 'lastname']
    },
    {
        code: 'ORGANIZATION_ALERT_SMS',
        description: 'Organization alert SMS event',
        category: 'organization',
        defaultContent: 'Attention: Organization {{name}} (ID: {{id}}, Referral: {{referralcode}}) has a new alert.',
        placeholders: ['name', 'id', 'referralcode']
    },
    {
        code: 'BIRTHDAY_SMS',
        description: 'Birthday greeting SMS event',
        category: 'patient',
        defaultContent: 'Happy Birthday {{designation}}! {{firstname}} {{lastname}}  Wishing you a wonderful year ahead from all of us at {{companyname}}.',
        placeholders: ['firstname', 'lastname', 'designation', 'companyname']
    },
    {
        code: 'HOLIDAY_GREETING_SMS',
        description: 'Holiday greeting SMS event',
        category: 'patient',
        defaultContent: 'Season’s greetings, {{firstname}}! Enjoy your holiday. - {{companyname}}',
        placeholders: ['firstname', 'companyname']
    }
];
function findEventByCode(code) {
    return exports.EVENTS.find(e => e.code === code);
}
exports.findEventByCode = findEventByCode;
function isEventValid(code) {
    return !!findEventByCode(code);
}
exports.isEventValid = isEventValid;
async function setEventActiveStatus(tenantId, code, active) {
    const conn = await (0, KnexConnections_1.default)(tenantId);
    const result = await conn('primesmsevents').where({ code }).update({ active });
    return result > 0;
}
exports.setEventActiveStatus = setEventActiveStatus;

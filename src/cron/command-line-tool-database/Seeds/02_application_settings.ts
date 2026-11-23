import { DEFAULT_BILLING_SETTINGS } from '../../../models/application/appsettings/billingSettingsDefaults';

exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex('applicationsettings')
    .del()
    .then(function () {
      return knex('applicationsettings').insert([
        {
          keyid: 1,
          bulkregistration: 1,
          fontsize: '14',
          textcolor: 'black',
          BackgroundColor: 'wheat',
          DeactivateBilling24hrs: 1,
          PaidBillsBeforeTransaction: 0,
          completeFlow: 1,
          approvalbeforeprinting: 1,
          smsActivated: 0,
          smsSettings: JSON.stringify({
            result: 'No',
            registration: 'Yes',
            sample: 'No',
            birthday: 'No',
          }),
          emailNotification: 0,
          emailModuleActivated: 0,
          includeTax: 1,
          patientIdPrefix: null,
          fontFamily: null,
          billingidPrefix: null,
          services: JSON.stringify({
            isConnectedInventory: 0,
            isPhysicianOfficeConnected: 0,
            isSupplierConnected: 0,
            isDoctorPortalConnected: 0,
            isResultAnalysisConnected: 0,
            isPatientPortalConnected: 0,
            isSmsServicesConnected: 0,
            isEmailServicesConnected: 0,
          }),
          billingsettings: JSON.stringify(DEFAULT_BILLING_SETTINGS),
          regioncode: 9,
          districtcode: 173,
        },
      ]);
    });
};
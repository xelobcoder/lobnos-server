exports.seed = async function (knex) {

     const registrationFields = {
          personalInformation: {
               designation: { visible: true, compulsory: true },
               email: { visible: true, compulsory: true },
               mobile: { visible: true, compulsory: true },
               age: { visible: true, compulsory: true },
               days: { visible: true, compulsory: true },
               months: { visible: true, compulsory: true },
               years: { visible: true, compulsory: true },
               gender: { visible: true, compulsory: true },
               whatAppcontact: { visible: true, compulsory: false },
               maritalstatus: { visible: true, compulsory: true },
               ageType: { visible: true, compulsory: true },
               firstname: { visible: true, compulsory: true },
               lastname: { visible: true, compulsory: true },
               middlename: { visible: true, compulsory: false },
               patienttype: { visible: true, compulsory: true },
               patientOrganization: { visible: true, compulsory: false },
               occupation: { visible: true, compulsory: false },
          },
          addressingInformation: {
               country: { visible: true, compulsory: true },
               area: { visible: true, compulsory: true },
               district: { visible: true, compulsory: true },
               region: { visible: true, compulsory: true },
               address: { visible: true, compulsory: true },
               gpsLocation: { visible: true, compulsory: false },
          },
          emmergencyInformation: {
               emmergencyContactName: { visible: true, compulsory: true },
               emmergencyContactNumber: { visible: true, compulsory: true },
               location: { visible: true, compulsory: true },
               address: { visible: true, compulsory: true },
               occupation: { visible: true, compulsory: false },
               relationship: { visible: true, compulsory: true },
          }
     }
     const jsonify = JSON.stringify(registrationFields);
     await knex('registrationsettings').insert({ fields: jsonify, updatedby: 1 })
}
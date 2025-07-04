"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billErrors = exports.ValidationError = exports.ClientPlsServiceLifecycle = exports.Client_PLS_Lifecycle = exports.serviceCategory = void 0;
exports.serviceCategory = {
    1: 'GENERAL',
    2: 'ORGANIZATION',
    3: 'PHIS',
    4: 'NHIS',
    6: 'CLINICIAN_SPECIAL_BILLING',
    5: 'SERVICES'
};
exports.Client_PLS_Lifecycle = {
    1: 'billing done',
    2: 'collection of sample Initiated',
    3: 'collection of sample concluded',
    4: 'sample validation in progress',
    5: 'sample validation concluded',
    6: 'sample in processing stage',
    7: 'processing of sample done',
    8: ' result entry initiated',
    9: 'result entry concluded',
    10: 'result validation concluded'
};
exports.ClientPlsServiceLifecycle = {
    1: "DONE",
    2: "PROGRESSING",
    0: "UNINITIATED"
};
var ValidationError;
(function (ValidationError) {
    ValidationError["CartAndServicesNotArrays"] = "Cart and servicesProvided must be arrays.";
    ValidationError["CartAndServicesEmpty"] = "Both cart and servicesProvided cannot be empty.";
    ValidationError["InvalidEmployeeId"] = "Invalid or missing employeeid.";
    ValidationError["InvalidBranchId"] = "Missing or invalid samplingCenter (branch id).";
    ValidationError["InvalidAmounts"] = "Amount payable and paid must be numbers.";
    ValidationError["InvalidPatientId"] = "Missing or invalid patientId.";
    ValidationError["PatientDoesNotExist"] = "Patient does not exist.";
    ValidationError["PromoCodeRequired"] = "Promo code is required when isPromo is true.";
    ValidationError["InvalidPaymentMode"] = "Invalid payment mode in payments array.";
})(ValidationError || (exports.ValidationError = ValidationError = {}));
var billErrors;
(function (billErrors) {
    billErrors["already"] = "client billed on same day. Kindly check the billing history to update billing";
    billErrors["failed"] = "billing client failed";
    billErrors["error"] = "error occured in processing  transaction";
    billErrors["badparams"] = "Bad Request provided";
    billErrors["unableToUpdateBilling"] = "Error Updating Billing Information";
    billErrors["unableToLoadServices"] = "Error Loading Services Provided";
    billErrors["unableToLoadTestAscension"] = "Error Adding data to Test Ascension ";
    billErrors["noDebtToClear"] = "No debts found for the patient";
    billErrors["NoValidBilling"] = "No valid billing ID provided";
})(billErrors || (exports.billErrors = billErrors = {}));

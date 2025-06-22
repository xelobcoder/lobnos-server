"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillErrors = exports.ClientPlsServiceLifecycle = exports.ClientPLSLifecycle = void 0;
// ClientPLSLifecycle and ClientPlsServiceLifecycle (Go map[int]string equivalent)
exports.ClientPLSLifecycle = {
    1: "billing done",
    2: "collection of sample Initiated",
    3: "collection of sample concluded",
    4: "sample validation in progress",
    5: "sample validation concluded",
    6: "sample in processing stage",
    7: "processing of sample done",
    8: " result entry initiated",
    9: "result entry concluded",
    10: "result validation concluded",
};
exports.ClientPlsServiceLifecycle = {
    1: "DONE",
    2: "PROGRESSING",
    0: "UNINITIATED",
};
var BillErrors;
(function (BillErrors) {
    BillErrors["Already"] = "client billed on same day. Kindly check the billing history to update billing";
    BillErrors["Failed"] = "billing client failed";
    BillErrors["Error"] = "error occured in processing  transaction";
    BillErrors["BadParams"] = "Bad Request provided";
    BillErrors["UnableToUpdateBilling"] = "Error Updating Billing Information";
    BillErrors["UnableToLoadServices"] = "Error Loading Services Provided";
    BillErrors["UnableToLoadTestAscension"] = "Error Adding data to Test Ascension ";
    BillErrors["NoDebtToClear"] = "No debts found for the patient";
    BillErrors["NoBillingSession"] = "No active billing session found for the given date and sampling center";
})(BillErrors || (exports.BillErrors = BillErrors = {}));

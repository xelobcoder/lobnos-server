"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTestPanelsAfterInsert = exports.applyClinicianAfterDelete = exports.applyClinicianAfterInsert = exports.applyOrganizationAfterInsert = exports.applyTestAscensionAfterInsertApprovalSettings = exports.applyDboservicesAfterDelete = exports.applyDboservicesAfterUpdate = exports.applyDboservicesAfterInsert = exports.insertDboservicesAudit = exports.applyNewPatientAfterDelete = exports.applyNewPatientAfterInsert = void 0;
const CommissionDefaultsRepository_1 = require("../models/commissions/CommissionDefaultsRepository");
async function applyNewPatientAfterInsert(db, payload) {
    const username = `${payload.firstname}${payload.lastname}`;
    const password = `${payload.firstname}${payload.lastname}${payload.patientid}`;
    await db("patients_credentials").insert({
        patientid: payload.patientid,
        username,
        password,
        updated_on: new Date(),
    });
    await db("patientemmergencycontactinformation").insert({
        patientid: payload.patientid,
    });
    await db("patientsaddress").insert({
        patientid: payload.patientid,
    });
    await db("patients_settings").insert({
        patientid: payload.patientid,
    });
}
exports.applyNewPatientAfterInsert = applyNewPatientAfterInsert;
async function applyNewPatientAfterDelete(db, patientid) {
    await db("patientemmergencycontactinformation").where({ patientid }).del();
    await db("patients_settings").where({ patientid }).del();
    await db("patients_credentials").where({ patientid }).del();
    await db("patientsaddress").where({ patientid }).del();
}
exports.applyNewPatientAfterDelete = applyNewPatientAfterDelete;
async function insertDboservicesAudit(db, service, action, actor) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    await db("dboservices_audit").insert({
        serviceid: service.serviceid,
        billingid: service.billingid,
        trackId: service.trackId,
        cost: service.cost,
        employeeid: service.employeeid,
        serviceCategory: service.serviceCategory,
        categoryTrackId: service.categoryTrackId,
        clinicianId: (_a = service.clinicianId) !== null && _a !== void 0 ? _a : null,
        organizationId: (_b = service.organizationId) !== null && _b !== void 0 ? _b : null,
        registrationType: (_c = service.registrationType) !== null && _c !== void 0 ? _c : null,
        branchid: service.branchid,
        isoutsourced: service.isoutsourced,
        outsourceid: (_d = service.outsourceid) !== null && _d !== void 0 ? _d : null,
        serviceAddedOn: service.serviceAddedOn,
        taxList: (_e = service.taxList) !== null && _e !== void 0 ? _e : null,
        taxValue: service.taxValue,
        amountIncurredDueTax: service.amountIncurredDueTax,
        taxIncluded: service.taxIncluded,
        discount: service.discount,
        totalcost: service.totalcost,
        totalpayable: service.totalpayable,
        isNHIS: service.isNHIS,
        isPHIS: service.isPHIS,
        insuranceid: (_f = service.insuranceid) !== null && _f !== void 0 ? _f : null,
        claimCode: (_g = service.claimCode) !== null && _g !== void 0 ? _g : null,
        hasNightAdjustment: service.hasNightAdjustment,
        nightAdjustmentValue: service.nightAdjustmentValue,
        nightAdjustmentMode: service.nightAdjustmentMode,
        isPackageUsed: service.isPackageUsed,
        packageid: (_h = service.packageid) !== null && _h !== void 0 ? _h : null,
        action_type: action,
        actor: actor !== null && actor !== void 0 ? actor : null,
        userAdjustmentType: (_j = service.userAdjustmentType) !== null && _j !== void 0 ? _j : null,
        userAdjustedValue: (_k = service.userAdjustedValue) !== null && _k !== void 0 ? _k : null,
    });
}
exports.insertDboservicesAudit = insertDboservicesAudit;
async function applyDboservicesAfterInsert(db, service, actor) {
    await insertDboservicesAudit(db, service, "INSERT", actor);
    if (service.serviceCategory === "SERVICES" && Number(service.categoryTrackId) === 5) {
        await db("servicestracking").insert({ serviceid: service.serviceid, employeeid: service.employeeid, status: 0, comments: "New service added, waiting for processing" });
    }
    const existingRefundRow = await db("dbobillingrefundtable")
        .select("refundid")
        .where({ serviceid: service.serviceid })
        .first();
    if (!existingRefundRow) {
        await db("dbobillingrefundtable").insert({
            serviceid: service.serviceid,
            refundedBy: 0,
            firstWitness: 0,
            secondWitness: 0,
            thirdWitness: 0,
        });
    }
    const isOutsourced = Number(service.isoutsourced) === 1;
    const outsourceId = service.outsourceid ? Number(service.outsourceid) : 0;
    if (isOutsourced && outsourceId > 0) {
        await db("outsourcedtesttracking").insert({
            serviceid: service.serviceid,
            testid: service.trackId,
            outsourceid: outsourceId,
            employeeid: service.employeeid,
            status: 0,
            comments: "New outsourced service added, waiting for dispatch",
        });
    }
    const clinicianId = service.clinicianId ? Number(service.clinicianId) : null;
    const organizationId = service.organizationId ? Number(service.organizationId) : null;
    let commissionType = null;
    let recipientId = null;
    if (clinicianId !== null) {
        commissionType = "clinician";
        recipientId = clinicianId;
    }
    else if (organizationId !== null) {
        commissionType = "organization";
        recipientId = organizationId;
    }
    if (commissionType && recipientId !== null) {
        let commissionPercentage = 0;
        if (commissionType === "clinician") {
            const row = await db("clinicianpaymentinfo")
                .select("commission")
                .where({ clinicianid: recipientId })
                .first();
            commissionPercentage = (row === null || row === void 0 ? void 0 : row.commission) ? Number(row.commission) : 0;
        }
        else {
            const row = await db("organizationaccountinformation")
                .select("commission")
                .where({ organizationid: recipientId })
                .first();
            commissionPercentage = (row === null || row === void 0 ? void 0 : row.commission) ? Number(row.commission) : 0;
        }
        // await db("commission_tracking").insert({
        // 	serviceid: service.serviceid,
        // 	commission_percentage: commissionPercentage,
        // 	commission_due: (Number(service.totalpayable || 0) * commissionPercentage) / 100,
        // 	type: commissionType,
        // 	recipient_id: recipientId,
        // 	calculated_at: db.fn.now(),
        // 	created_at: db.fn.now(),
        // 	updated_at: db.fn.now(),
        // });
    }
}
exports.applyDboservicesAfterInsert = applyDboservicesAfterInsert;
async function applyDboservicesAfterUpdate(db, service, actor) {
    await insertDboservicesAudit(db, service, "UPDATE", actor);
}
exports.applyDboservicesAfterUpdate = applyDboservicesAfterUpdate;
async function applyDboservicesAfterDelete(db, service, actor) {
    await insertDboservicesAudit(db, service, "DELETE", actor);
}
exports.applyDboservicesAfterDelete = applyDboservicesAfterDelete;
async function applyTestAscensionAfterInsertApprovalSettings(db, ascensionid) {
    const existing = await db("dbotestresultapproval").select("id").where({ ascensionid }).first();
    if (existing)
        return;
    let minvalidation = 1;
    let maxvalidation = 2;
    const row = await db("resultsettings").select("resultsEntrySettings")
        .where({ id: 1 }).first();
    let settings = row === null || row === void 0 ? void 0 : row.resultsEntrySettings;
    if (typeof settings === "string") {
        try {
            settings = JSON.parse(settings);
        }
        catch (_a) {
            settings = null;
        }
    }
    const minRaw = settings === null || settings === void 0 ? void 0 : settings.minimumResultValidation;
    const maxRaw = settings === null || settings === void 0 ? void 0 : settings.maximumResultValidation;
    const minParsed = minRaw !== undefined && minRaw !== null ? Number(minRaw) : NaN;
    const maxParsed = maxRaw !== undefined && maxRaw !== null ? Number(maxRaw) : NaN;
    if (!isNaN(minParsed) && isFinite(minParsed))
        minvalidation = minParsed;
    if (!isNaN(maxParsed) && isFinite(maxParsed))
        maxvalidation = maxParsed;
    await db("dbotestresultapproval").insert({
        ascensionid,
        minvalidation,
        maxvalidation,
        printCount: 0,
    });
}
exports.applyTestAscensionAfterInsertApprovalSettings = applyTestAscensionAfterInsertApprovalSettings;
async function applyOrganizationAfterInsert(db, organizationid) {
    const contact = await db("organizationcontactperson")
        .select("id")
        .where({ organizationid })
        .first();
    if (!contact) {
        await db("organizationcontactperson").insert({ organizationid });
    }
    const account = await db("organizationaccountinformation")
        .select("id")
        .where({ organizationid })
        .first();
    if (!account) {
        // insert default commission value for the organization if global commission default exist for organization
        const commissionDefault = await new CommissionDefaultsRepository_1.CommissionDefaultsRepository(0, db).getByTargetType('ORGANIZATION');
        const commissionValue = commissionDefault ? commissionDefault.commission_value : 0;
        await db("organizationaccountinformation").insert({ organizationid, commission: commissionValue });
    }
}
exports.applyOrganizationAfterInsert = applyOrganizationAfterInsert;
async function applyClinicianAfterInsert(tenantId, db, payload) {
    // 1. check for default commissions for clinician exist , if yes use the default value to create the clinician commision amount else create with 0 commission
    const commissionDefault = await new CommissionDefaultsRepository_1.CommissionDefaultsRepository(tenantId, db).getByTargetType('CLINICIAN');
    const commissionValue = commissionDefault ? commissionDefault.commission_value : 0;
    const payment = await db("clinicianpaymentinfo")
        .select("id")
        .where({ clinicianid: payload.clinicianid })
        .first();
    if (!payment) {
        await db("clinicianpaymentinfo").insert({
            clinicianid: payload.clinicianid,
            module: "cash",
            commission: commissionValue,
        });
    }
    const credentials = await db("clinicianscredentials")
        .select("id")
        .where({ clinicianid: payload.clinicianid })
        .first();
    if (!credentials) {
        const crypto = await Promise.resolve().then(() => __importStar(require("crypto")));
        const randomPassword = crypto.randomBytes(10).toString("hex");
        await db("clinicianscredentials").insert({
            clinicianid: payload.clinicianid,
            identifier: payload.identifier,
            password: randomPassword,
            authenticationMode: "SMS",
        });
    }
}
exports.applyClinicianAfterInsert = applyClinicianAfterInsert;
async function applyClinicianAfterDelete(db, clinicianid) {
    await db("clinicianpaymentinfo").where({ clinicianid }).del();
    await db("clinicianscredentials").where({ clinicianid }).del();
}
exports.applyClinicianAfterDelete = applyClinicianAfterDelete;
async function applyTestPanelsAfterInsert(db, payload) {
    const existingDetails = await db("testdetails").select("id").where({ testid: payload.testid }).first();
    if (!existingDetails) {
        await db("testdetails").insert({
            testid: payload.testid,
            testcost: payload.price,
            testprice: payload.price,
            updatedby: 0,
            childrenlimit: "",
            instrumentation: "",
        });
    }
    const isCustom = Number(payload.iscustom) === 1;
    if (isCustom) {
        const existingCustom = await db("customtestcreation").select("id").where({ testid: payload.testid }).first();
        if (!existingCustom) {
            await db("customtestcreation").insert({ testid: payload.testid });
        }
    }
}
exports.applyTestPanelsAfterInsert = applyTestPanelsAfterInsert;

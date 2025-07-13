"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Billing = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const helper_1 = require("../../hooks/helper");
const testpanelList_1 = require("../../testpanel/testpanelList");
const appset_1 = __importDefault(require("../application/appsettings/appset"));
const invoice_1 = require("../invoice/invoice");
const ascension_1 = require("../operations/ascension");
const organization_1 = __importDefault(require("../organization/organization"));
const organizationBilling_1 = __importDefault(require("../organization/organizationBilling"));
const outsourcing_1 = __importDefault(require("../organization/outsourcingOrganization/outsourcing"));
const registration_1 = __importDefault(require("../registration/registration"));
const services_1 = require("../services/services");
const billingclientTypes_1 = require("./billingclientTypes");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const partitioning_1 = __importDefault(require("./partitioning"));
const queries_1 = require("./queries");
const RefundClass_1 = require("./RefundClass");
const core_1 = __importDefault(require("../../EmailServices/core"));
const SalesSessionRepo_1 = require("./repositories/SalesSessionRepo");
const N = 2;
class Billing {
    constructor(patientid) {
        this.patientid = patientid;
    }
    async insertTestBillingAsAServices(tenantId, discountedValue, testid, isOutsourced, outsourceid = null, totalcost, data) {
        try {
            const { billingid, employeeid, serviceCategory, categoryTrackId, type, clinicianId, organizationId, branchid, taxIncluded = 0, taxList = null, taxValue = 0, amountIncurredDueTax = 0, insuranceId } = data;
            const isPHIS = categoryTrackId == 3 ? 1 : 0;
            const isServiced = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_new_services_billing_test, [
                billingid, testid, discountedValue, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, type, branchid, isOutsourced, outsourceid, taxList, amountIncurredDueTax, taxValue, taxIncluded, totalcost, 0, isPHIS, insuranceId, null
            ]);
            return (0, helper_1.rowAffected)(isServiced) ? isServiced.insertId : false;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    }
    async determineStageOfRefundRequest(tenantId, data) {
        try {
            const { categoryTrackId, serviceid, serviceCategoryName } = data;
            let stage = null;
            if ([2, 1, 3, 4, 6].includes(categoryTrackId) && billingclientTypes_1.serviceCategory[categoryTrackId] === serviceCategoryName) {
                const { id: ascensionId } = await new TiifuWorkingClass_1.TiifuWorkingClass('test_ascension').findOne(tenantId, 'serviceid', serviceid);
                if (ascensionId) {
                    stage = await ascension_1.TestAscension.determineStage(tenantId, ascensionId);
                    return stage;
                }
                return ascensionId;
            }
            if (categoryTrackId === 5 && billingclientTypes_1.serviceCategory[categoryTrackId] === serviceCategoryName) {
                stage = await new services_1.Services(serviceid).getServiceProgress(tenantId);
            }
            return stage;
        }
        catch (err) {
            console.log(err);
            return null;
        }
    }
    async getClientBillingInformation(tenantId, billingid) {
        if (!billingid)
            throw new Error("billingid not provided");
        if (typeof billingid !== "number") {
            throw new TypeError("billingid must be a number");
        }
        const servicesList = await services_1.Services.findAllServicesAssociatedWithBillingId(tenantId, billingid);
        if (servicesList.length === 0)
            return [];
        const previousRecords = await this.diffentiateBilledToIndividualServices(tenantId, servicesList);
        return previousRecords;
    }
    static async totalRecordedPayment(tenantId, billingid) {
        if (!billingid)
            return "Resource not found." /* OperationsFailures.notFound */;
        const billinghxRecords = await new TiifuWorkingClass_1.TiifuWorkingClass("billinghx").findMany(tenantId, "billingid", billingid);
        if (billinghxRecords.length == 0)
            return false;
        let totalDebit = 0;
        let totalCredit = 0;
        billinghxRecords.forEach((record) => {
            if (record.type === 'debit') {
                totalDebit += parseFloat(record.Amount.toString());
            }
            else {
                totalCredit += parseFloat(record.Amount.toString());
            }
        });
        totalDebit = parseFloat(totalDebit.toFixed(2));
        totalCredit = parseFloat(totalCredit.toFixed(2));
        const totalPayment = parseFloat((totalCredit - totalDebit).toFixed(2));
        const allPayment = parseFloat((totalDebit + totalCredit).toFixed(2));
        return {
            totalDebit,
            totalCredit,
            totalPayment,
            allPayment
        };
    }
    diffentiateBilledToIndividualServices(tenantId, servicesList) {
        return Promise.all(servicesList.map(async (item) => {
            const addVitalInformation = async function (item) {
                const { isoutsourced, trackId, categoryTrackId, serviceAddedOn, outsourceid, organizationId } = item;
                let OutSourcingOrganization = [];
                let outsouring_organization = null;
                if (isoutsourced == 1 && outsourceid) {
                    OutSourcingOrganization = await new outsourcing_1.default(null, null).getOrganizationBasicInformation(tenantId, outsourceid);
                    if (Array.isArray(OutSourcingOrganization) && OutSourcingOrganization.length > 0) {
                        outsouring_organization = OutSourcingOrganization[0]['name'];
                    }
                }
                switch (categoryTrackId) {
                    case 1:
                        let testname1 = await testpanelList_1.testpanel.getTestUsingTestid(tenantId, trackId);
                        return Object.assign(Object.assign({}, item), { outsourcingOrganization: outsouring_organization, name: testname1 });
                    case 5:
                        const servicenformation = await new services_1.Services(trackId).getAService(tenantId);
                        let testname5 = await testpanelList_1.testpanel.getTestUsingTestid(tenantId, trackId);
                        return servicenformation.length === 0
                            ? Object.assign(Object.assign({}, item), { name: testname5 }) : Object.assign(Object.assign({}, item), { name: servicenformation[0]['serviceName'], testname: testname5 });
                    case 2:
                        const organizationalBillingName = await new organizationBilling_1.default(organizationId).getOrganizationBasic(tenantId);
                        let testName2 = await testpanelList_1.testpanel.getTestUsingTestid(tenantId, item.trackId);
                        return organizationalBillingName.length === 0
                            ? Object.assign(Object.assign({}, item), { name: testName2 }) : Object.assign(Object.assign({}, item), { outsourcingOrganization: outsouring_organization, organizationName: organizationalBillingName[0]['name'], name: testName2 });
                    case 3:
                        let testname3 = await testpanelList_1.testpanel.getTestUsingTestid(tenantId, trackId);
                        return Object.assign(Object.assign({}, item), { name: testname3 });
                    case 6:
                        let testname6 = await testpanelList_1.testpanel.getTestUsingTestid(tenantId, trackId);
                        return Object.assign(Object.assign({}, item), { name: testname6 });
                    default:
                        return [];
                }
            };
            const records = await addVitalInformation(item);
            const witnesses = await RefundClass_1.Refund.getservicesRefundWithness(tenantId, item.serviceid);
            return Object.assign(Object.assign({}, records), { witnesses });
        }));
    }
    async getTransactionBillData(tenantId, billingid) {
        return await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM billing WHERE billingid = ? `, [billingid]);
    }
    async getBranchDayBilledClients(tenantId, branchid, { count = 10, page = 1 }) {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const day = currentDate.getDate();
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.currentDateBilledClients, [currentYear, month, day, branchid]);
        return result;
    }
    async generateBillingid(tenantId, patientid, trx) {
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const query = trx || connection;
            const [billingId] = await query("billing")
                .insert({ patientid })
                .returning('billingid');
            if (typeof billingId === 'number') {
                return billingId;
            }
            else {
                throw new Error('Failed to generate billingid: Invalid billingid returned');
            }
        }
        catch (error) {
            console.error('Error generating billingid:', error);
            return undefined;
        }
    }
    static async getReceiptPdfExternalSystem(tenantId, billingid, patientid) {
        try {
            const billedData = await (0, invoice_1.getBillingInvoiceData)(tenantId, billingid);
            if (!billedData)
                return false;
            const patientData = await registration_1.default.getPatientDataUsingPatientId(tenantId, patientid);
            if (!patientData || !patientData['email']) {
                return "Resource not found." /* OperationsFailures.notFound */;
            }
            const pdfResponse = await fetch(`${process.env.PDFGENERATOR_CHANNEL_ENDPOINT}/generate/receipt/invoice?billingid=${billingid}&&is_pos=true`);
            if (!pdfResponse.ok)
                return false;
            const pdfBuffer = await pdfResponse.arrayBuffer();
            const pdfBufferNode = Buffer.from(pdfBuffer);
            const pdfPath = path_1.default.join(__dirname, '../../../views/pdfs/patient-receipt.pdf');
            await promises_1.default.writeFile(pdfPath, pdfBufferNode);
            const status = await new core_1.default().sendBilledReceipt(pdfPath, patientData['email']);
            return status;
        }
        catch (err) {
            console.log(err);
        }
    }
    static calculateBillingVariablesFinal(services, test, taxValue, serviceCategoryTrackId, testCategoryTrackId, paid) {
        const payableofTest = Billing.calulateTotalPayableServices(testCategoryTrackId, test, taxValue);
        const payableofServices = Billing.calulateTotalPayableServices(serviceCategoryTrackId, services, taxValue);
        const { amountIncurredDueTax: a1, totalDiscount: d1, payable: p1, totalServiceCost: t1, totalcost: v1 } = payableofTest;
        const { amountIncurredDueTax: a2, totalDiscount: d2, payable: p2, totalServiceCost: t2, totalcost: v2 } = payableofServices;
        let payable = parseFloat((p1 + p2).toFixed(2));
        let amountIncurredDueTax = parseFloat((a1 + a2).toFixed(2));
        let totalDiscount = parseFloat((d1 + d2).toFixed(2));
        let outstanding = parseFloat((payable - paid).toFixed(2));
        let totalcost = parseFloat((v1 + v2).toFixed(2));
        return { payable, outstanding, totalDiscount, amountIncurredDueTax, totalcost };
    }
    async verificationAndReformatingOfTestAndPrice(tenantId, item, categoryTrackId, associate) {
        try {
            const { organizationId, insuranceId, clinicianId } = associate;
            const { testid, id, organization, discount } = item;
            const trackId = testid ? testid : id;
            let outsourceid = null;
            let isOutsourced = false;
            let price = null;
            let serviceid = null;
            let amountIncurredDueTax = 0;
            let ascensionId = null;
            const hasOrganization = organization && organization.hasOwnProperty("outsourceid");
            if (hasOrganization) {
                outsourceid = organization.outsourceid;
                isOutsourced = true;
            }
            if (categoryTrackId == 1) {
                const testpanel = await new TiifuWorkingClass_1.TiifuWorkingClass("test_panels").findOne(tenantId, "id", trackId);
                price = testpanel['price'];
            }
            if (categoryTrackId == 2) {
                price = await this.getTestOrganizationPriceValue(tenantId, organizationId, trackId, price);
            }
            if (categoryTrackId === 3) {
                // const { discountedValue, isoutsourced } = await new ClinicianBillingStrategy().getStrategySingleTestValue(tenantId, insuranceId, 'phis', trackId) as unknown as {
                // 	discountedValue: number, isoutsourced:number
                // }
                // price = discountedValue;
                // isOutsourced = isoutsourced == 1;
            }
            if (categoryTrackId === 6) {
                // const { discountedValue, isoutsourced } = await new ClinicianBillingStrategy().getStrategySingleTestValue(tenantId, clinicianId, 'clinicians', trackId);
                // if (discountedValue >= 0) {
                // 	price = discountedValue;
                // 	isOutsourced = isoutsourced == 1;
                // }
            }
            let parsedDiscount = discount ? discount : 0;
            return {
                amountIncurredDueTax,
                discountedValue: price,
                serviceid,
                trackId,
                isOutsourced,
                outsourceid,
                ascensionId,
                discount: parsedDiscount
            };
        }
        catch (error) {
            throw error;
        }
    }
    applyNightAdjustmentToItems(items) {
        return items.map(item => {
            if (item.hasNightAdjustment &&
                item.discountedValue !== null &&
                !isNaN(item.discountedValue)) {
                if (item.nightAdjustmentMode === 'absolute') {
                    item.discountedValue += item.nightAdjustmentValue;
                }
                else if (item.nightAdjustmentMode === 'percentage') {
                    item.discountedValue *= (item.nightAdjustmentValue / 100);
                }
            }
            return item;
        });
    }
    async billClient(tenantId, data, taxValue, taxList) {
        let billingid = null;
        let trx;
        try {
            const { patientid, cart, servicesProvided, paid, taxValue, billingSource, organizationId, insuranceId, clinicianId, employeeid, type, samplingCenter, taxIncluded, isPackageUsed } = data;
            const connection = await (0, KnexConnections_1.default)(tenantId);
            trx = await connection.transaction();
            billingid = await this.generateBillingid(tenantId, patientid, trx);
            const applyNightAdjustmentToTestCartItems = await this.verificationOfTestAndNightAdjustment(tenantId, cart, billingSource, organizationId, insuranceId, clinicianId, taxValue, isPackageUsed);
            const values = await this.processTestCart(applyNightAdjustmentToTestCartItems, billingSource, organizationId, insuranceId, clinicianId, taxValue, billingid, employeeid, type, samplingCenter, taxList, taxIncluded, isPackageUsed);
            const applyNightAdjustmentToServiceItems = await this.verificationOfServicesAndNightAdjustment(tenantId, servicesProvided, 5, taxValue, isPackageUsed);
            const services = await this.processServicesCart(applyNightAdjustmentToServiceItems, billingid, data, taxList);
            let allEntries = [...values, ...services];
            if (allEntries.length > 0) {
                const billing_final_values = Billing.calculateBillingVariablesFinal(applyNightAdjustmentToServiceItems, applyNightAdjustmentToTestCartItems, taxValue, 5, billingSource, paid);
                const loadAllServices = await this.mapAndInsertServices(tenantId, allEntries, billingid, trx);
                if (loadAllServices.length > 0) {
                    throw new Error(billingclientTypes_1.billErrors.unableToLoadServices);
                }
                const { payable, outstanding, totalDiscount, amountIncurredDueTax, totalcost } = billing_final_values;
                const isUpdated = await trx('billing')
                    .where({ billingid })
                    .update({
                    totalTransactionCost: totalcost,
                    totalcost,
                    paid,
                    payable,
                    discount: totalDiscount,
                    amountIncurredDueTax,
                    outstanding,
                    balance: 0,
                    totalRefunded: 0,
                });
                if (!isUpdated) {
                    throw new Error(billingclientTypes_1.billErrors.unableToUpdateBilling);
                }
                await trx.raw(queries_1.insertbillHistoryQuery, [billingid, data.paymentmode, data.paid, data.employeeid, data.type]);
                await trx.commit();
                return billingid;
            }
            return billingid;
        }
        catch (err) {
            console.log(err);
            await trx.rollback();
            throw new Error(billingclientTypes_1.billErrors.error);
        }
    }
    async mapAndInsertServices(tenantId, allEntries, billingid, trx) {
        try {
            const servicesMap = allEntries.map((service) => {
                return [
                    service.billingid,
                    service.trackId,
                    service.cost,
                    service.employeeid,
                    service.serviceCategory,
                    service.categoryTrackId,
                    service.clinicianId,
                    service.organizationId,
                    service.registrationType,
                    service.branchid,
                    service.isoutsourced || 0,
                    service.outsourceid || null,
                    service.serviceAddedOn,
                    service.taxList,
                    service.taxValue,
                    service.amountIncurredDueTax,
                    service.taxIncluded,
                    service.discount,
                    service.totalcost,
                    service.totalpayable,
                    service.isNHIS,
                    service.isPHIS,
                    service.insuranceid,
                    service.claimCode,
                    service.hasNightAdjustment,
                    service.nightAdjustmentMode,
                    service.nightAdjustmentValue,
                    service.isPackageUsed,
                    service.packageid
                ];
            });
            const loadAllServices = await this.loadMultipleServices(servicesMap, billingid, tenantId, trx);
            return loadAllServices;
        }
        catch (err) {
            console.log('Error Loading services ');
            throw err;
        }
    }
    async verificationOfServicesAndNightAdjustment(tenantId, servicesProvided, billingSource = 5, taxValue, isPackageUsed) {
        let verifyAndReformatServices = servicesProvided;
        if (!isPackageUsed) {
            verifyAndReformatServices = await Promise.all(servicesProvided.map(async (item, index) => {
                const result = await this.verificationAndReformatingOfServics(tenantId, item);
                return Object.assign(Object.assign({}, item), result);
            }));
            const applyNightAdjustmentToServiceItems = this.applyNightAdjustmentToItems(verifyAndReformatServices);
            return applyNightAdjustmentToServiceItems.map((item, index) => {
                const summary = Billing.calulateTotalPayableServices(billingSource, [item], taxValue);
                return Object.assign(Object.assign({}, summary), item);
            });
        }
        else {
            return servicesProvided.map((item, index) => {
                const summary = Billing.calulateTotalPayableServices(billingSource, [item], taxValue);
                return Object.assign(Object.assign({}, summary), item);
            });
        }
    }
    async processTestCart(cart, billingSource, organizationId, insuranceId, clinicianId, taxValue, billingid, employeeid, type, samplingCenter, taxList, taxIncluded, isPackageUsed) {
        return await Promise.all(cart.map(async (item) => {
            const { hasNightAdjustment, nightAdjustmentMode, nightAdjustmentValue, isoutsourced, isOutsourced } = item;
            return {
                billingid,
                trackId: item.testid,
                cost: item.discountedValue,
                employeeid,
                serviceCategory: billingclientTypes_1.serviceCategory[billingSource],
                categoryTrackId: billingSource,
                clinicianId,
                organizationId,
                registrationType: type,
                branchid: samplingCenter,
                isoutsourced: isoutsourced || isOutsourced,
                outsourceid: item.outsourceid || null,
                serviceAddedOn: new Date(),
                taxList,
                taxValue,
                amountIncurredDueTax: item.amountIncurredDueTax,
                taxIncluded,
                discount: item.discount,
                totalcost: item.totalcost,
                totalpayable: item.payable,
                isNHIS: billingSource === 4 ? 1 : 0,
                isPHIS: billingSource === 3 ? 1 : 0,
                insuranceid: insuranceId || null,
                claimCode: null,
                hasNightAdjustment: hasNightAdjustment ? 1 : 0,
                nightAdjustmentMode,
                nightAdjustmentValue,
                isPackageUsed: isPackageUsed ? 1 : 0,
                packageid: item === null || item === void 0 ? void 0 : item.package_id
            };
        }));
    }
    async verificationOfTestAndNightAdjustment(tenantId, cart, billingSource, organizationId, insuranceId, clinicianId, taxValue, isPackageUsed) {
        let details = cart;
        if (!isPackageUsed) {
            details = await Promise.all(cart.map(async (item, index) => {
                const result = await this.verificationAndReformatingOfTestAndPrice(tenantId, item, billingSource, {
                    organizationId,
                    insuranceId,
                    clinicianId
                });
                return Object.assign(Object.assign({}, item), result);
            }));
            const applyNightAdjustmentToItems = this.applyNightAdjustmentToItems(details);
            const summary = applyNightAdjustmentToItems.map((_single, index) => {
                const summary = Billing.calulateTotalPayableServices(billingSource, [_single], taxValue);
                return Object.assign(Object.assign({}, _single), summary);
            });
            return summary;
        }
        else {
            return cart.map((_single, index) => {
                const summary = Billing.calulateTotalPayableServices(billingSource, [_single], taxValue);
                return Object.assign(Object.assign({}, _single), summary);
            });
        }
    }
    async processServicesCart(applyNightAdjustmentToServiceItems, billingid, billingdata, taxList) {
        const { organizationId, clinicianId, employeeid, samplingCenter, taxValue, taxIncluded, type, billingSource, insuranceId, isPackageUsed } = billingdata;
        return await Promise.all(applyNightAdjustmentToServiceItems.map(async (item) => {
            return {
                billingid,
                trackId: item.keyid,
                cost: item.discountedValue,
                employeeid,
                serviceCategory: billingclientTypes_1.serviceCategory[5],
                categoryTrackId: 5,
                clinicianId,
                organizationId,
                registrationType: type,
                branchid: samplingCenter,
                isoutsourced: 0,
                outsourceid: 0,
                serviceAddedOn: new Date(),
                taxList,
                taxValue,
                amountIncurredDueTax: item.amountIncurredDueTax,
                taxIncluded,
                discount: item.totalDiscount,
                totalcost: item.totalcost,
                totalpayable: item.payable,
                isNHIS: billingSource === 4 ? 1 : 0,
                isPHIS: billingSource === 3 ? 1 : 0,
                insuranceid: insuranceId || null,
                claimCode: null,
                hasNightAdjustment: item.hasNightAdjustment,
                nightAdjustmentMode: item.nightAdjustmentMode,
                nightAdjustmentValue: item.nightAdjustmentValue,
                isPackageUsed: isPackageUsed ? 1 : 0,
                packageid: (item === null || item === void 0 ? void 0 : item.package_id) || null,
            };
        }));
    }
    async isCompleteFlow(tenantId) {
        const settings = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM applicationsettings`);
        return settings.length == 0 ? false : settings[0]["completeFlow"] == 1;
    }
    static async updateBillingInformation(tenantId, payable, paid, amountIncurredDueTax, outstanding, balance, discount, billingid, totalRefunded, totalcost, transactioncost) {
        const values = [paid, payable, outstanding, discount, amountIncurredDueTax, balance, totalRefunded, totalcost, transactioncost, billingid];
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_Billing_Information, values);
        return (0, helper_1.rowAffected)(result);
    }
    async updateBillingHistory(tenantId, paymentmode, billingid, amount) {
        const values = [paymentmode, amount, billingid];
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.updatebillHistoryQuery, values);
    }
    async insertBillingHistory(tenantId, paymentmode, billingid, amount, employeeid, type = "credit") {
        try {
            const values = [billingid, paymentmode, amount, employeeid, type];
            return await (0, helper_1.promisifyQuery)(tenantId, queries_1.insertbillHistoryQuery, values);
        }
        catch (err) {
            throw err;
        }
    }
    async deleteBillingHistory(tenantId, billingid) {
        if (billingid)
            return false;
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.deleteNewBillPaymentHx, [billingid]);
    }
    async updateApprovalStatus(tenantId, ascensionId) {
        try {
            const query = `UPDATE samplestatus SET approvalstatus = 1 WHERE ascensionid = ?`;
            const values = [ascensionId];
            return (0, helper_1.promisifyQuery)(tenantId, query, values);
        }
        catch (err) {
            throw new Error(err);
        }
    }
    async deleteTestAscension(tenantId, serviceid, testid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.deleteAscensionidQuery, [serviceid, testid]);
        return (0, helper_1.rowAffected)(result);
    }
    async haveBeenBilledToday(tenantId, patientid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.patientBilledTodayQuery, [patientid]);
        return !(result[0]["count"] > 0);
    }
    async getClientTodayBillingid(tenantId, patientid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_today_client_billingid, [patientid]);
        if (result.length == 0)
            return false;
        return result[0]['billingid'];
    }
    async deleteBillTransaction(tenantId, billingid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.deleteBillTransactionQuery, [billingid]);
    }
    async cleanUpRecordedPaymentHx(tenantId, billingid) {
        await (0, helper_1.promisifyQuery)(tenantId, queries_1.deleteNewBillPaymentHx, [billingid]);
    }
    static async inCompleteFlowTestAscensionUpdate(employeeid, date, ascensionId) {
        try {
            // const testAscensionClass = new TestAscension(ascensionId);
            // await testAscensionClass.updateTestAscensionStatus("collectionStartDate", new Date(), employeeid);
            // await testAscensionClass.updateTestAscensionStatus("collectionEndDate", new Date(), employeeid);
            // await new Billing(null).updateApprovalStatus(ascensionId);
            // await testAscensionClass.updateTestAscensionStatus("processingStartDate", new Date(), employeeid);
            // await testAscensionClass.updateTestAscensionStatus("processingEndDate", new Date(), employeeid);
        }
        catch (err) {
            throw err;
        }
    }
    static getBilledTaxValues(packet) {
        if (packet.hasOwnProperty("taxList") === false)
            return 0;
        const { taxList } = packet;
        let parsedPacketTaxList = JSON.parse(taxList);
        if (Array.isArray(parsedPacketTaxList) && parsedPacketTaxList.length > 0) {
            parsedPacketTaxList = parsedPacketTaxList.reduce((a, b) => a + b.value, 0);
        }
        return parsedPacketTaxList;
    }
    static async checkValidityOfBillingid(tenantId, billingid) {
        const result = await new TiifuWorkingClass_1.TiifuWorkingClass('billing').findOne(tenantId, "billingid", billingid);
        return result && result.billingid == billingid;
    }
    static async getTotalPriceFromSavedServices(tenantId, billingid, refundInclusive) {
        const query = refundInclusive
            ? `
        SELECT
            COALESCE(SUM(ss.totalcost), 0) AS totalCost,
            COALESCE(SUM(ss.discount), 0) AS totalDiscount,
            COALESCE(SUM(ss.amountIncurredDueTax), 0) AS totalAmountIncurredDueTax,
            COALESCE(SUM(ss.totalcost - ss.discount), 0) AS totalPayable,
            COALESCE(SUM(rr.amountRefunded), 0) AS totalRefunded
        FROM dboservices AS ss
        LEFT JOIN dbobillingrefundtable AS rr
            ON rr.serviceid = ss.serviceid
        WHERE ss.billingid = ? AND rr.isRefundCompleted = 0
        `
            : `
        SELECT 
            COALESCE(SUM(ss.totalcost), 0) AS totalCost, 
            COALESCE(SUM(ss.discount), 0) AS totalDiscount, 
            COALESCE(SUM(ss.amountIncurredDueTax), 0) AS totalAmountIncurredDueTax, 
            COALESCE(SUM(ss.totalcost - ss.discount), 0) AS totalPayable,
            COALESCE(SUM(
                CASE 
                    WHEN rr.isRefundApproved = 1 AND rr.isRefundCompleted = 1 AND rr.isRefundInitiated = 1 
                    THEN ss.totalcost 
                    ELSE 0 
                END
            ), 0) AS totalRefunded
        FROM dboservices AS ss
        LEFT JOIN dbobillingrefundtable AS rr 
            ON rr.serviceid = ss.serviceid 
        WHERE ss.billingid = ?
        `;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection.raw(query, [billingid]);
        const row = result[0][0] || {};
        const totalCost = Number(row.totalCost || 0);
        const totalDiscount = Number(row.totalDiscount || 0);
        const totalAmountIncurredDueTax = Number(row.totalAmountIncurredDueTax || 0);
        const totalPayable = Number(row.totalPayable || 0);
        const totalRefunded = Number(row.totalRefunded || 0);
        const transactioncost = totalCost + totalRefunded;
        return {
            totalAmountIncurredDueTax,
            totalCost,
            totalDiscount,
            totalPayable,
            totalRefunded,
            transactioncost
        };
    }
    async loadTestAscensionMultiple(tenantId, data, categoryTrackId, servicesBillingData, includeTax, taxValue, taxList) {
        if (data.length === 0)
            return false;
        let verifiedTestPricing = [];
        const { billingid, organizationId, clinicianId, insuranceId } = servicesBillingData;
        for (const item of data) {
            try {
                var { amountIncurredDueTax, discountedValue, serviceid, trackId, isOutsourced, outsourceid, ascensionId: prevAscensionId } = await this.verificationAndReformatingOfTestAndPrice(tenantId, item, categoryTrackId, { insuranceId, organizationId, clinicianId });
                let ascensionId = null;
                if (includeTax == 1) {
                    amountIncurredDueTax = discountedValue * (taxValue / 100);
                }
                let loadingValues = Object.assign(Object.assign({}, servicesBillingData), { taxIncluded: includeTax, taxValue, amountIncurredDueTax, taxList });
                const totalCost = amountIncurredDueTax + discountedValue;
                serviceid = await this.insertTestBillingAsAServices(tenantId, discountedValue, trackId, isOutsourced, outsourceid, totalCost, loadingValues);
                if (typeof serviceid == "boolean" && !serviceid) {
                    throw new Error('services not inserted');
                }
                if (typeof serviceid == 'number') {
                    ascensionId = await this.AddtoTestAscenstion(tenantId, serviceid, billingid, trackId);
                }
                if (!ascensionId)
                    throw new Error("test ascensionid not added");
                // this would have made the sample,processing states to be updated to collected
                // this.updateAscensionStates(isItCompleteFlow, ascensionId, employeeid, verifiedTestPricing, trackId, discountedValue);
            }
            catch (error) {
                throw error;
            }
        }
        return verifiedTestPricing;
    }
    async verificationAndReformatingOfServics(tenantId, item) {
        const { keyid, discount } = item;
        const serviceItem = await new TiifuWorkingClass_1.TiifuWorkingClass('additionalservices').findOne(tenantId, "keyid", keyid);
        const { servicePrice } = serviceItem;
        return { discountedValue: servicePrice, discount: discount | 0 };
    }
    updateAscensionStates(isItCompleteFlow, ascensionId, employeeid, verifiedTestPricing, trackId, price) {
        try {
            if (isItCompleteFlow === false && ascensionId) {
                Billing.inCompleteFlowTestAscensionUpdate(employeeid, new Date(), ascensionId);
            }
            verifiedTestPricing.push({ testid: trackId, price });
        }
        catch (error) {
            throw error;
        }
    }
    static calculateTotalServicesValue(categoryTrackId, data) {
        if (data.length === 0)
            return 0;
        if (!(categoryTrackId && billingclientTypes_1.serviceCategory[categoryTrackId]))
            throw new Error(`categoryTrackId ${categoryTrackId} not found`);
        const amount = parseFloat(TiifuWorkingClass_1.TiifuWorkingClass.reduceListInOF(data, 'discountedValue'));
        return amount;
    }
    static calculateTotalDiscount(data) {
        return parseFloat(TiifuWorkingClass_1.TiifuWorkingClass.reduceListInOF(data, 'discount') || 0);
    }
    static calulateTotalPayableServices(categoryTrackId, data, taxValue) {
        let totalServiceCost = 0;
        let totalcost = 0;
        let totalDiscount = 0;
        let payable = 0;
        let amountIncurredDueTax = 0;
        totalServiceCost = this.calculateTotalServicesValue(categoryTrackId, data);
        totalDiscount = this.calculateTotalDiscount(data);
        if (taxValue === 0) {
            payable = parseFloat((totalServiceCost - totalDiscount).toFixed(2));
            totalcost = parseFloat(totalServiceCost.toFixed(2));
        }
        else {
            amountIncurredDueTax = parseFloat(Billing.amountIncurredDueTaxes(totalServiceCost, taxValue).toFixed(2));
            totalcost = parseFloat((totalServiceCost + amountIncurredDueTax).toFixed(2));
            payable = parseFloat((totalServiceCost + amountIncurredDueTax - totalDiscount).toFixed(2));
        }
        return { amountIncurredDueTax, payable, totalServiceCost, totalDiscount, totalcost };
    }
    static amountIncurredDueTaxes(totalServiceCost, taxValue) {
        return (totalServiceCost) * (taxValue / 100);
    }
    async getTestOrganizationPriceValue(tenantId, organizationId, trackId, price) {
        try {
            const organization = new organization_1.default(organizationId);
            const isValidOrganization = await organization.isProvidedOrganizationIdValid(tenantId, organizationId);
            if (!isValidOrganization)
                throw new Error("Resource not found." /* OperationsFailures.notFound */);
            const { testList } = await new organizationBilling_1.default(organizationId).getOrganizationalBilling(tenantId);
            if (Array.isArray(testList) && testList.length > 0) {
                const filterTest = testList.filter((a, index) => a['testid'] === trackId);
                if (filterTest.length == 0)
                    throw new Error("Resource not found." /* OperationsFailures.notFound */);
                price = filterTest[0]['discountedValue'];
            }
            return price;
        }
        catch (error) {
            throw error;
        }
    }
    static async updatePreviouslyBilledClientAfterRefundConcluded(tenantId, records) {
        try {
            const { billingid, refundAmount } = records;
            const isBillingIdValid = await Billing.checkValidityOfBillingid(tenantId, billingid);
            if (!isBillingIdValid)
                return false;
            const previousBillingRecord = await new Billing(null).getTransactionBillData(tenantId, billingid);
            if (previousBillingRecord.length === 0)
                return false;
            let { paid, payable, totalcost, totalrefunded, totalTransactionCost, discount, amountIncurredDueTax } = previousBillingRecord[0];
            const serviceInformation = await new TiifuWorkingClass_1.TiifuWorkingClass("dboservices").findOne(tenantId, "serviceid", records.serviceid);
            if (serviceInformation) {
                const servicepayable = serviceInformation.totalpayable;
                const servicetotalcost = serviceInformation.totalcost;
                const servicediscount = serviceInformation.discount;
                const serviceAmountIncurredDueTax = serviceInformation.amountIncurredDueTax;
                const newRefundableAmount = parseFloat(totalrefunded.toString()) + parseFloat(refundAmount.toString());
                const currentPayable = parseFloat(payable.toString()) - parseFloat(servicepayable.toString());
                const currentPaid = parseFloat(paid.toString()) - refundAmount;
                const currentTotalCost = parseFloat(totalcost.toString()) - parseFloat(servicetotalcost.toString());
                const currentDiscount = parseFloat(discount.toString()) - parseFloat(servicediscount.toString());
                const currentAmountIncurredDueTax = parseFloat(amountIncurredDueTax.toString()) - parseFloat(serviceAmountIncurredDueTax.toString());
                let newOutstandingAmount = 0;
                let newBalanceAmount = 0;
                if (currentPaid >= currentPayable) {
                    newBalanceAmount = currentPaid - currentPayable;
                }
                else {
                    newOutstandingAmount = currentPayable - currentPaid;
                }
                const updateSuccess = await Billing.updateBillingInformation(tenantId, currentPayable, currentPaid, currentAmountIncurredDueTax, newOutstandingAmount, newBalanceAmount, currentDiscount, billingid, newRefundableAmount, currentTotalCost, totalTransactionCost);
                return updateSuccess;
            }
        }
        catch (err) {
            throw err;
            ;
        }
    }
    static async removeDuplicateServiceFromNewCart(tenantId, services, categoryTrackId, billingid) {
        let unique = [];
        for (let i = 0; i < services.length; i++) {
            const { id, testid, keyid } = services[i];
            const trackId = testid ? testid : id ? id : keyid;
            const hasAlreadyBeenBilled = await services_1.Services.hasServiceWithBillingIdAndTrackId(tenantId, billingid, categoryTrackId, trackId);
            if (!hasAlreadyBeenBilled)
                unique.push(services[i]);
        }
        return unique;
    }
    async BillNewTransaction(tenantId, billingData) {
        let billingid = undefined;
        try {
            const today = new Date();
            const sessionExists = await new SalesSessionRepo_1.SalesSessionRepo(tenantId)
                .hasActiveSessionForDate(today, billingData.samplingCenter);
            if (!sessionExists)
                return "No active sales session found for the current date." /* OperationsFailures.sessionNotFound */;
            const billdataValidation = await Billing.validateBillingRequestBody(tenantId, billingData);
            if (billdataValidation !== true) {
                return billdataValidation;
            }
            const { taxValue } = await new appset_1.default().getAppBillSettings(tenantId);
            let taxList = null;
            if (taxValue > 0) {
                taxList = await new TiifuWorkingClass_1.TiifuWorkingClass("tax").findMany(tenantId, "apply", 'yes');
                taxList = JSON.stringify(taxList);
            }
            billingid = await this.billClient(tenantId, billingData, taxValue, taxList);
            if (typeof billingid == "boolean" || !billingid)
                return billingclientTypes_1.billErrors.failed;
            return billingid;
        }
        catch (err) {
            if (billingid) {
                await this.cleanUpFailedbillingProcess(tenantId, billingid);
            }
            if ((err === null || err === void 0 ? void 0 : err.code) && (err === null || err === void 0 ? void 0 : err.errno) == 1526) {
                const currentYear = new Date().getFullYear();
                await new partitioning_1.default("billing", 'billing').addYearPartition(tenantId, currentYear);
                await new partitioning_1.default("test_ascension", 'asc').addYearPartition(tenantId, currentYear);
            }
            return billingclientTypes_1.billErrors.error;
        }
    }
    static async validatePaymentModeId(tenantId, id) {
        const data = await new TiifuWorkingClass_1.TiifuWorkingClass("paymentmodes").findMany(tenantId, "KeyID", id);
        return Array.isArray(data) && data.length > 0;
    }
    static async validateBillingRequestBody(tenantId, billingData) {
        const { cart, servicesProvided, employeeid, paymentmode, samplingCenter, billingSource, paid, discount, patientid, payable, insuranceId, clinicianId } = billingData;
        if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
            return "InvalidCartOrServices" /* BillingValidationResult.INVALID_CART_OR_SERVICES */;
        }
        if (cart.length === 0 && servicesProvided.length === 0) {
            return "EmptyCartAndServices" /* BillingValidationResult.EMPTY_CART_AND_SERVICES */;
        }
        if (!employeeid || typeof employeeid !== "number") {
            return "InvalidEmployeeID" /* BillingValidationResult.INVALID_EMPLOYEE_ID */;
        }
        if (!paymentmode || !(await this.validatePaymentModeId(tenantId, parseInt(paymentmode.toString(), 10)))) {
            return "InvalidPaymentMode" /* BillingValidationResult.INVALID_PAYMENT_MODE */;
        }
        if (!samplingCenter) {
            return "MissingBranchID" /* BillingValidationResult.MISSING_BRANCH_ID */;
        }
        if (isNaN(payable) || isNaN(paid) || isNaN(discount)) {
            return "InvalidPayableOrPaid: Field should be a valid number (payable, paid, or discount)" /* BillingValidationResult.INVALID_PAYABLE_OR_PAID */;
        }
        if (!patientid) {
            return "MissingPatientID" /* BillingValidationResult.MISSING_PATIENT_ID */;
        }
        if (!(await registration_1.default.checkPatientIdExist(tenantId, patientid))) {
            return "PatientId Invalid" /* BillingValidationResult.INVALID_PATIENT_ID */;
        }
        if (!billingSource || !billingclientTypes_1.serviceCategory[billingSource]) {
            return "Billingsource missing or invalid" /* BillingValidationResult.INVALID_MISSING_BILLING_SOURCE */;
        }
        if (billingSource && billingSource == 5 && !clinicianId) {
            return "Provided Billing Source and Detail do not match" /* BillingValidationResult.INVALID_BILLING_SOURCE_MATCH */;
        }
        if (billingSource && billingSource == 4 && !insuranceId) {
            return "Provided Billing Source and Detail do not match" /* BillingValidationResult.INVALID_BILLING_SOURCE_MATCH */;
        }
        function ensureNumericFields(data) {
            const fieldsToConvert = ["outstanding", "paid", "payable"];
            for (const field of fieldsToConvert) {
                const value = data[field];
                if (typeof value === "string") {
                    const parsedValue = parseFloat(value);
                    if (isNaN(parsedValue)) {
                        return "InvalidPayableOrPaid: Field should be a valid number (payable, paid, or discount)" /* BillingValidationResult.INVALID_PAYABLE_OR_PAID */;
                    }
                    data[field] = parsedValue;
                }
                else if (typeof value !== "number") {
                    return "InvalidPayableOrPaid: Field should be a valid number (payable, paid, or discount)" /* BillingValidationResult.INVALID_PAYABLE_OR_PAID */;
                }
            }
            return true;
        }
        const isNumericForNumerics = ensureNumericFields(billingData);
        if (isNumericForNumerics != true) {
            return isNumericForNumerics;
        }
        return true;
    }
    async updatePreviousTransaction(tenantId, billingData, billingid) {
        const { employeeid, billingSource, type, clinicianId, organizationId, samplingCenter, insuranceId } = billingData;
        try {
            if (!billingid || typeof billingid !== "number") {
                throw new Error("billingid not provided or invalid");
            }
            const { cart, servicesProvided = [], isPackageUsed } = billingData;
            const validBillingIdProvided = await Billing.checkValidityOfBillingid(tenantId, billingid);
            if (!validBillingIdProvided)
                return "Resource not found." /* OperationsFailures.notFound */;
            const billdataValidation = await Billing.validateBillingRequestBody(tenantId, billingData);
            if (billdataValidation !== true)
                return billdataValidation;
            if (!Array.isArray(cart) || !Array.isArray(servicesProvided) || (cart.length <= 0 && servicesProvided.length <= 0)) {
                return "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */;
            }
            const parsedPayment = parseFloat(billingData.paid.toString());
            const currentPayment = parseFloat(parsedPayment.toFixed(2));
            let taxList = null;
            const { includeTax, taxValue } = await new appset_1.default().getAppBillSettings(tenantId);
            if (includeTax === 1) {
                taxList = JSON.stringify(await new TiifuWorkingClass_1.TiifuWorkingClass("tax").findMany(tenantId, "apply", 'yes'));
            }
            let testCart = await Billing.removeDuplicateServiceFromNewCart(tenantId, cart, billingSource, billingid);
            let testServices = await Billing.removeDuplicateServiceFromNewCart(tenantId, servicesProvided, billingSource, billingid);
            if (testCart.length != cart.length || servicesProvided.length != testServices.length) {
                return "some requested services already exist for this transaction, please kindly check the previous billing of this transaction" /* OperationsFailures.someRequestedServicesAlreadyExistForThisTransaction */;
            }
            if (testCart.length === 0 && testServices.length === 0) {
                return "All requested services already exist for this transaction" /* OperationsFailures.allRequestedServicesAlreadyExistForThisTransaction */;
            }
            const applyNightAdjustmentToServiceItems = await this.verificationOfServicesAndNightAdjustment(tenantId, testServices, 5, taxValue, isPackageUsed);
            const applyNightAdjustmentToTestCartItems = await this.verificationOfTestAndNightAdjustment(tenantId, testCart, billingSource, organizationId, insuranceId, clinicianId, taxValue, isPackageUsed);
            const processTestCart = await this.processTestCart(applyNightAdjustmentToTestCartItems, billingSource, organizationId, insuranceId, clinicianId, taxValue, billingid, employeeid, type, samplingCenter, taxList, includeTax == 1, isPackageUsed);
            const services = await this.processServicesCart(applyNightAdjustmentToServiceItems, billingid, billingData, taxList);
            let allEntries = [...processTestCart, ...services];
            if (allEntries.length == 0)
                return "Test With Such Name Already Exist" /* OperationsFailures.TestExist */;
            const billing_final_values = Billing.calculateBillingVariablesFinal(applyNightAdjustmentToServiceItems, applyNightAdjustmentToTestCartItems, taxValue, 5, billingSource, billingData.paid);
            const previousBilling = await this.getTransactionBillData(tenantId, billingid);
            if (previousBilling && Array.isArray(previousBilling) && previousBilling.length > 0) {
                const previousBillingData = previousBilling[0];
                const updatedBillingValues = this.calculateUpdatedBillingValues(previousBillingData, billing_final_values, billingData.paid);
                if (updatedBillingValues.totalPaid > updatedBillingValues.totalPayable) {
                    return "Payment exceeds payable amount" /* OperationsFailures.paymentExceedsPayableAmount */;
                }
                const connection = await (0, KnexConnections_1.default)(tenantId);
                const trx = await connection.transaction();
                try {
                    const loadAllServices = await this.mapAndInsertServices(tenantId, allEntries, billingid, trx);
                    if (loadAllServices.length > 0) {
                        throw new Error(billingclientTypes_1.billErrors.unableToLoadServices);
                    }
                    const uBillingValues = await trx("billing")
                        .update({
                        totalcost: updatedBillingValues.totalCost,
                        payable: updatedBillingValues.totalPayable,
                        paid: updatedBillingValues.totalPaid,
                        discount: updatedBillingValues.totalDiscount,
                        totalTransactionCost: updatedBillingValues.totalTotalTransactionCost,
                        amountIncurredDueTax: updatedBillingValues.totalTax,
                        outstanding: updatedBillingValues.currentTotalOutstanding,
                        totalrefunded: previousBillingData.totalrefunded
                    })
                        .where({ billingid });
                    // since we are upating then the categoryTrackId of the previous shoudld be the same as the current
                    await trx('dboservices')
                        .update({
                        isNHIS: billingSource === 4 ? 1 : 0,
                        isPHIS: billingSource === 3 ? 1 : 0,
                        insuranceid: insuranceId || null,
                        claimCode: null,
                        organizationId,
                        clinicianId,
                        registrationType: type,
                        branchid: samplingCenter,
                        serviceCategory: billingclientTypes_1.serviceCategory[billingSource],
                        categoryTrackId: billingSource,
                    }).where({ billingid });
                    if (uBillingValues == 1) {
                        const hx = await trx.raw(queries_1.insertbillHistoryQuery, [billingid, billingData.paymentmode, billingData.paid, billingData.employeeid, billingData.type]);
                        await trx.commit();
                        return (0, helper_1.rowAffected)(hx[0]);
                    }
                }
                catch (error) {
                    console.log(error);
                    await trx.rollback();
                    throw error;
                }
            }
        }
        catch (error) {
            console.error("Error in updatePreviousTransaction:", error);
            throw error;
        }
    }
    calculateUpdatedBillingValues(previousBillingData, billing_final_values, paidAmount) {
        const previousPaid = parseFloat(previousBillingData.paid);
        const previousRefunded = parseFloat(previousBillingData.totalrefunded);
        const previousDiscount = parseFloat(previousBillingData.discount);
        const previousOutstanding = parseFloat(previousBillingData.outstanding);
        const previousTotalTransactionCost = parseFloat(previousBillingData.totalTransactionCost);
        const previousTotalCost = parseFloat(previousBillingData.totalcost);
        const previousPayable = parseFloat(previousBillingData.payable);
        const previousTaxValue = parseFloat(previousBillingData.amountIncurredDueTax);
        const { payable: currentPayable, totalDiscount: currentDiscount, totalcost: currentTotalCost, amountIncurredDueTax: currentTax, outstanding: currentOutstanding } = billing_final_values;
        const totalPayable = previousPayable + currentPayable;
        const totalDiscount = previousDiscount + currentDiscount;
        const totalCost = previousTotalCost + currentTotalCost;
        const totalTax = previousTaxValue + currentTax;
        const totalOutstanding = previousOutstanding + currentOutstanding;
        const totalPaid = previousPaid + paidAmount;
        const totalTotalTransactionCost = (previousTotalTransactionCost + currentTotalCost) - previousRefunded;
        let currentTotalOutstanding = totalPaid < totalPayable ? totalPayable - totalPaid : 0;
        return {
            totalCost,
            totalPayable,
            totalPaid,
            totalDiscount,
            totalTotalTransactionCost,
            totalTax,
            currentTotalOutstanding
        };
    }
    async multipleServicesAscensionProcess(tenantId, cart, insertionErrors, servicesBillingData, billingid, isItCompleteFlow, employeeid) {
        for (let i = 0; i < cart.length && insertionErrors.length == 0; i++) {
            let ascensionId = null;
            const { discountedValue, testid, id, organization } = cart[i];
            const correctTestid = testid ? testid : id;
            let outsourceid = null;
            let isOutsourced = false;
            if (organization && typeof organization == "object" && organization.hasOwnProperty('outsourceid')) {
                outsourceid = organization.outsourceid;
                isOutsourced = true;
            }
            const isServicesDullyInserted = await this.insertTestBillingAsAServices(tenantId, discountedValue, correctTestid, isOutsourced, outsourceid, 0, servicesBillingData);
            if (typeof isServicesDullyInserted == "boolean" && !isServicesDullyInserted) {
                insertionErrors.push(correctTestid);
                throw new Error('services not inserted');
            }
            if (typeof isServicesDullyInserted == 'number') {
                ascensionId = await this.AddtoTestAscenstion(tenantId, isServicesDullyInserted, billingid, correctTestid);
            }
            if (!ascensionId)
                throw new Error("test ascensionid not added");
            if (isItCompleteFlow === false && ascensionId) {
                Billing.inCompleteFlowTestAscensionUpdate(employeeid, new Date(), ascensionId);
            }
        }
    }
    async cleanUpFailedbillingProcess(tenantId, billingid) {
        await this.deleteBillTransaction(tenantId, billingid);
        // const servicesClass = new Services(null);
        // servicesClass.deleteServicesAssociatedToBillingId(billingid);
        // await this.deleteBillingHistory(billingid);
        // const testAscensionClass = new TestAscension(null);
        // await testAscensionClass.deleteBilledAssociatedAscension(billingid);
    }
    async loadMultipleServices(services, billingid, tenantId, trx) {
        const insertionErrors = [];
        const queryRunner = trx || await (0, KnexConnections_1.default)(tenantId);
        for (const item of services) {
            try {
                const [billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid, serviceAddedOn, taxList, taxValue, amountIncurredDueTax, taxIncluded, discount, totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode, hasNightAdjustment, nightAdjustmentMode, nightAdjustmentValue, isPackageUsed, packageid] = item;
                const outcome = await queryRunner("dboservices").insert({
                    billingid,
                    trackId,
                    cost,
                    employeeid,
                    serviceCategory,
                    categoryTrackId,
                    clinicianId,
                    organizationId,
                    registrationType,
                    branchid,
                    isoutsourced,
                    outsourceid,
                    serviceAddedOn,
                    taxList,
                    taxValue,
                    amountIncurredDueTax,
                    taxIncluded,
                    discount,
                    totalcost,
                    totalpayable,
                    isNHIS,
                    isPHIS,
                    insuranceid,
                    claimCode,
                    hasNightAdjustment,
                    nightAdjustmentMode,
                    nightAdjustmentValue,
                    isPackageUsed,
                    packageid
                });
                if (outcome && item[5] != 5 && item[1]) {
                    try {
                        await this.AddtoTestAscenstion(tenantId, outcome[0], billingid, item[1], queryRunner);
                    }
                    catch (err) {
                        throw new Error(billingclientTypes_1.billErrors.unableToLoadTestAscension);
                    }
                }
            }
            catch (err) {
                console.error("Error inserting service:", err);
                insertionErrors.push(err);
            }
        }
        return insertionErrors;
    }
    async AddtoTestAscenstion(tenantId, serviceid, billingid, testid, trx) {
        try {
            if (!billingid || !serviceid || !testid)
                return false;
            const queryRunner = trx || await (0, KnexConnections_1.default)(tenantId);
            const isInserted = await queryRunner.raw(queries_1.AddtoTestAscenstionQuery, [testid, serviceid, billingid]);
            // const result = await TestApprovalClass.addAprovalItem(tenantId, isInserted.insertId, trx);
            // console.log(result)
            return isInserted.insertId;
        }
        catch (err) {
            console.log(err);
            if (err && err.code && err.errno == 1526 && err.code == 'ER_NO_PARTITION_FOR_GIVEN_VALUE'.trim()) {
                const currentYear = new Date().getFullYear();
                await new partitioning_1.default("test_ascension", "asc").addYearPartition(tenantId, currentYear);
            }
            return false;
        }
    }
}
exports.Billing = Billing;

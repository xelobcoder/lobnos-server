"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitCustomerBilling = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const billing_shared_1 = require("./billing_shared");
const billing_shared_types_1 = require("./multi/billing_shared_types");
const billingclientTypes_1 = require("./billingclientTypes");
const PrimeBillingPromoCodeRepo_1 = require("./repositories/PrimeBillingPromoCodeRepo");
const customerBillingCheckout_1 = require("./multi/customerBillingCheckout");
const PrimeEventsDataSource_1 = require("../application/sms/events/PrimeEventsDataSource");
const appLevelTriggers_1 = require("../../database/appLevelTriggers");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const discount_limit_1 = __importDefault(require("./billing-services/discount-limit"));
const commission_configurations_1 = require("../commissions/commission-configurations");
class SubmitCustomerBilling {
    static getPaidAmountAndStatus(item) {
        var _a, _b, _c, _d;
        const paidamount = (typeof item.paidamount !== 'undefined' && !isNaN(item.paidamount) && typeof parseFloat(item.paidamount.toString()) === 'number')
            ? Number(item.paidamount)
            : 0;
        let paymentstatus;
        const p_totalpayable = isNaN(parseInt(((_a = item.totalpayable) === null || _a === void 0 ? void 0 : _a.toString()) || '0')) ? 0 : parseFloat(((_b = item.totalpayable) === null || _b === void 0 ? void 0 : _b.toString()) || '0');
        const p_paidamount = isNaN(parseInt(((_c = item.paidamount) === null || _c === void 0 ? void 0 : _c.toString()) || '0')) ? 0 : parseFloat(((_d = item.paidamount) === null || _d === void 0 ? void 0 : _d.toString()) || '0');
        const outstanding = p_totalpayable - p_paidamount;
        if (p_paidamount != null) {
            if ((p_totalpayable && p_paidamount === p_totalpayable) || p_totalpayable === 0) {
                paymentstatus = 'paid';
            }
            else if (p_paidamount > 0) {
                paymentstatus = 'partial';
            }
            else {
                paymentstatus = 'pending';
            }
        }
        else {
            paymentstatus = 'pending';
        }
        return { paidamount, paymentstatus, outstanding };
    }
    constructor(payload, tenantId) {
        this.payload = payload;
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async adjustmentCorrectionDetermination(billingid, currentEntity) {
        // 1. using the billingid we will load and get the entity information 
        // 2. use the services and test and use the current entity information and compute the necessary adjustments
        // 3. compare the two and forward the details to the frontend
    }
    async submit() {
        var _a, _b;
        try {
            const _c = this.payload, { tenantId, patientId, billingid, cart, servicesProvided, paymentDetails, branchid, billingSource, referalCode, promoCode, nhismembershipid, claimscheckcode, isPromo, writeOffOutstanding, isPackageUsed, packageid, amountPayable, employeeid, samplingCenter, billeddate, isAdjustment, adjustmentdate, adjustmentType, organizationId, clinicianId, adjustmentReason, payments, status, entitytype, entityId, isPayAll, entityid, isConditionsUnderstood, hasNightAdjustment, promoMethod, result_delivery } = _c, rest = __rest(_c, ["tenantId", "patientId", "billingid", "cart", "servicesProvided", "paymentDetails", "branchid", "billingSource", "referalCode", "promoCode", "nhismembershipid", "claimscheckcode", "isPromo", "writeOffOutstanding", "isPackageUsed", "packageid", "amountPayable", "employeeid", "samplingCenter", "billeddate", "isAdjustment", "adjustmentdate", "adjustmentType", "organizationId", "clinicianId", "adjustmentReason", "payments", "status", "entitytype", "entityId", "isPayAll", "entityid", "isConditionsUnderstood", "hasNightAdjustment", "promoMethod", "result_delivery"]);
            const checkoutResult = await customerBillingCheckout_1.CustomerBillingCheckout.checkoutCustomerBilling({
                patientId,
                billingid,
                cart,
                servicesList: servicesProvided,
                paymentDetails,
                branchid,
                billingSource,
                referalCode,
                promoCode,
                isPromo,
                isPackageUsed,
                packageid,
                entityid,
                entitytype,
                employeeid,
                tenantId
            });
            if (checkoutResult.success == false) {
                return { status: false, message: `Checkout validation failed: ${checkoutResult.message}` };
            }
            if (billingSource == 4 && (!nhismembershipid || !claimscheckcode || isNaN(nhismembershipid) || isNaN(claimscheckcode))) {
                return { status: false, message: "Please Provide Valid NHIS MEMBERSHIP ID and Claims Check Code to continue " };
            }
            let hasRelatedBilling = false;
            if (this.payload.billingid) {
                const isBillingIdValid = await billing_shared_1.BillingSharedRepo.checkValidityOfBillingID(this.payload.billingid, this.tenantId);
                if (!isBillingIdValid)
                    return { status: false, message: billingclientTypes_1.billErrors.NoValidBilling };
                hasRelatedBilling = true;
            }
            if (hasRelatedBilling) {
                const canAdjust = await billing_shared_1.BillingSharedRepo.canAdjustBilling(this.payload.billingid, this.tenantId);
                if (!canAdjust.status) {
                    return { status: false, message: canAdjust.message };
                }
            }
            if (typeof checkoutResult === 'string' || Array.isArray(checkoutResult)) {
                return { status: false, message: `Checkout validation failed: ${checkoutResult}` };
            }
            const data = checkoutResult.data;
            const summaryFields = [
                'subtotal',
                'totaldiscount',
                'totalAmountIncurredDueTax',
                'totalServiceAmount',
                'amountPayable',
            ];
            for (const field of summaryFields) {
                if (typeof data[field] === 'number' && typeof this.payload[field] === 'number' && Math.abs(data[field] - this.payload[field]) > 0.01) {
                    return { status: false, message: `Submitted ${field} (${this.payload[field]}) does not match recalculated value (${data[field]}).` };
                }
            }
            let updatedBillingData = this.payload;
            if (updatedBillingData.isPackageUsed && !updatedBillingData.packageid) {
                updatedBillingData.cart = data.packageTestList;
            }
            const conn = await this.connection;
            const trx = await conn.transaction();
            let billingID = 0;
            let finalBillingIdForEvent = 0;
            try {
                if (!hasRelatedBilling) {
                    billingID = await billing_shared_1.BillingSharedRepo.generateBillingID(this.payload.patientid || this.payload.patientId, this.tenantId, this.payload.branchid || this.payload.branchId, this.payload.employeeid || this.payload.employeeId, trx);
                }
                else {
                    billingID = this.payload.billingid;
                }
                finalBillingIdForEvent = billingID;
                const computeAdjustmentTotals = (items) => {
                    let discountTotal = 0;
                    let surchargeTotal = 0;
                    if (!Array.isArray(items))
                        return { discountTotal, surchargeTotal };
                    for (const item of items) {
                        const adjType = typeof (item === null || item === void 0 ? void 0 : item.userAdjustmentType) === 'string' ? item.userAdjustmentType.toLowerCase() : item === null || item === void 0 ? void 0 : item.userAdjustmentType;
                        const adjValue = Math.abs(Number((item === null || item === void 0 ? void 0 : item.userAdjustedValue) || 0));
                        if (adjType === 'discount' && adjValue > 0) {
                            discountTotal += adjValue;
                            continue;
                        }
                        if (adjType === 'surcharge' && adjValue > 0) {
                            surchargeTotal += adjValue;
                            continue;
                        }
                        const promoDiscount = Number((item === null || item === void 0 ? void 0 : item.promoDiscount) || 0);
                        if (promoDiscount > 0)
                            continue;
                        const itemDiscount = Math.abs(Number((item === null || item === void 0 ? void 0 : item.discount) || 0));
                        if (itemDiscount > 0) {
                            discountTotal += itemDiscount;
                        }
                    }
                    return { discountTotal, surchargeTotal };
                };
                const adjustmentItems = [
                    ...(Array.isArray(data.cart) ? data.cart : []),
                    ...(Array.isArray(data.servicesList) ? data.servicesList : []),
                    ...(Array.isArray(data.packageTestList) ? data.packageTestList : [])
                ];
                const computedAdjustments = computeAdjustmentTotals(adjustmentItems);
                const totalDiscountFromCheckout = !data.isPromo && typeof data.totaldiscount === 'number' ? data.totaldiscount : 0;
                const totalSurchargeFromCheckout = typeof data.totalsurcharge === 'number' ? data.totalsurcharge : 0;
                const effectiveDiscountTotal = Math.max(Number(totalDiscountFromCheckout || 0), Number(computedAdjustments.discountTotal || 0));
                const effectiveSurchargeTotal = Math.max(Number(totalSurchargeFromCheckout || 0), Number(computedAdjustments.surchargeTotal || 0));
                const parsedEmployeeId = parseInt((employeeid || this.payload.employeeid || this.payload.employeeId).toString(), 10);
                if (!parsedEmployeeId || isNaN(parsedEmployeeId))
                    throw new Error("Missing employeeid for discount validation.");
                const previousBilling = hasRelatedBilling
                    ? await trx("billing").where({ billingid: billingID }).first()
                    : null;
                const previousDiscount = previousBilling ? Number(previousBilling.discount || 0) : 0;
                const previousSurcharges = previousBilling ? Number(previousBilling.surcharges || 0) : 0;
                const isAddition = !!(hasRelatedBilling && this.payload.adjustmentType === "addition" && this.payload.billingid);
                const newDiscountTotal = isAddition ? previousDiscount + effectiveDiscountTotal : effectiveDiscountTotal;
                const newSurchargeTotal = isAddition ? previousSurcharges + effectiveSurchargeTotal : effectiveSurchargeTotal;
                const deltaDiscount = Math.max(0, newDiscountTotal - previousDiscount);
                const deltaSurcharge = Math.max(0, newSurchargeTotal - previousSurcharges);
                const role = new user_1.default().getUserRole(employeeid, tenantId);
                if (role && typeof role == 'string' && role != 'admin') {
                    await discount_limit_1.default.enforceAndRecord({
                        tenantId: this.tenantId,
                        trx,
                        employeeid: parsedEmployeeId,
                        billingid: billingID,
                        subtotal: typeof data.subtotal === 'number' ? data.subtotal : undefined,
                        payable: typeof data.amountPayable === 'number' ? data.amountPayable : undefined,
                        discountTotal: deltaDiscount || 0,
                        surchargeTotal: deltaSurcharge || 0,
                        branchid: updatedBillingData.branchid
                    });
                }
                const taxValue = updatedBillingData.taxValue || 0;
                const taxList = updatedBillingData.taxList || null;
                const taxIncluded = updatedBillingData.taxIncluded || false;
                const processTestCart = await SubmitCustomerBilling.processTestCartWithoutRecalculation(updatedBillingData, billingID, taxValue, taxIncluded, taxList, trx, hasRelatedBilling, this.payload.billingid);
                const processNonTestServices = await SubmitCustomerBilling.processNonTestServices(updatedBillingData, (updatedBillingData.servicesProvided || []).map(service => (Object.assign(Object.assign({}, service), { amountPaid: typeof service.amountPaid === 'number' ? service.amountPaid : 0, status: service.status || 'pending' }))), billingID, taxValue, taxList, hasRelatedBilling, this.payload.billingid);
                const allEntries = [...processNonTestServices, ...processTestCart];
                if (allEntries.length === 0) {
                    throw new Error("No billable services/tests found.");
                }
                const Multi = new billing_shared_1.BillingSharedRepo();
                const loadAllServices = await Multi.mapAndInsertServices(this.tenantId, allEntries, billingID, patientId, result_delivery, billeddate ? billeddate : new Date(), trx);
                if (loadAllServices.length > 0) {
                    const firstErr = loadAllServices[0];
                    const messageFromErr = typeof firstErr === "string"
                        ? firstErr
                        : firstErr && typeof firstErr.message === "string"
                            ? firstErr.message
                            : null;
                    throw new Error(messageFromErr || billing_shared_types_1.BillErrors.UnableToLoadServices);
                }
                let totalcost = 0;
                let totalservicesAmount = 0;
                let totalAmountPayable = checkoutResult.data.amountPayable || 0;
                let testPayableAmount = 0;
                let totaldiscount = 0;
                let totalAmountIncurredDueTax = 0;
                let totalOutstanding = 0;
                let balance = 0;
                let writeOffAmount = 0;
                let overallPaymentsMade = updatedBillingData.paid;
                let status = this.payload.paid == amountPayable ? "paid" : this.payload.paid > 0 ? "partial" : "pending";
                testPayableAmount = data.testPayableAmount || 0;
                totalcost = data.totalcost;
                totalservicesAmount = data.totalServiceAmountPayable;
                totaldiscount = data.totaldiscount || 0;
                totalAmountIncurredDueTax = data.totalAmountIncurredDueTax;
                totalOutstanding = Math.max(amountPayable - updatedBillingData.paid, 0);
                balance = totalOutstanding > 0 ? 0 : updatedBillingData.paid - totalAmountPayable;
                const surcharges = ((_a = checkoutResult.data) === null || _a === void 0 ? void 0 : _a.totalsurcharge) || 0;
                const updateData = {
                    totalTransactionCost: totalcost,
                    totalcost: totalcost,
                    totalServiceAmountPayable: totalservicesAmount,
                    amountPayable: totalAmountPayable,
                    testPayableAmount: testPayableAmount,
                    totaldiscount: totaldiscount,
                    totalAmountIncurredDueTax: totalAmountIncurredDueTax,
                    outstanding: totalOutstanding,
                    paid: overallPaymentsMade,
                    surcharges,
                    balance: balance,
                    status,
                    totalrefunded: 0,
                    isPromo: data.isPromo || false,
                    promoValue: data.promoValue || 0,
                    promoMethod: data.promoMethod || promoMethod,
                    promoCodeId: data.promoCodeId || promoCode,
                    lastupdatedby: employeeid || this.payload.employeeid,
                };
                const { adjustmentType, isAdjustment, adjustmentReason } = this.payload;
                if (isAdjustment && adjustmentType === "correction" && this.payload.billingid) {
                    await trx("billing")
                        .where({ billingid: this.payload.billingid })
                        .update({
                        adjustmentType: "correction",
                        adjustmentReason,
                        adjustedBy: employeeid || this.payload.employeeid,
                        adjustmentdate: new Date(),
                        isAdjustment: 1,
                        islocked: 1,
                        lastupdatedby: employeeid || this.payload.employeeid,
                    });
                    await trx("dboservices")
                        .where({ billingid: this.payload.billingid })
                        .update({
                        isAdjustment: 1,
                        isCorrected: 1,
                        relatedBillingid: parseInt(this.payload.billingid),
                        isLocked: 1,
                    });
                    const updatedServices = await trx("dboservices").where({ billingid: this.payload.billingid });
                    for (const service of updatedServices) {
                        await (0, appLevelTriggers_1.applyDboservicesAfterUpdate)(trx, service, (_b = (employeeid || this.payload.employeeid)) === null || _b === void 0 ? void 0 : _b.toString());
                    }
                }
                const dataToUpdate = {
                    patientid: updatedBillingData.patientId,
                    totalcost: updateData.totalcost,
                    totalTransactionCost: updateData.totalTransactionCost,
                    totalrefunded: updateData.totalrefunded,
                    discount: updateData.totaldiscount,
                    paid: this.payload.paid,
                    payable: updateData.amountPayable,
                    outstanding: updateData.outstanding,
                    balance: updateData.balance,
                    clientstatus: status || "normal",
                    status,
                    amountIncurredDueTax: updateData.totalAmountIncurredDueTax,
                    branchid: updatedBillingData.branchid,
                    isPromo: updateData.isPromo,
                    promoValue: updateData.promoValue,
                    surcharges: updateData.surcharges,
                    additionalinformation: this.payload.additioninformation || null,
                    promoMethod: updateData.promoMethod ? updateData.promoMethod : null,
                    promoCodeId: updateData.promoCodeId ? updateData.promoCodeId : null,
                    isAdjustment: hasRelatedBilling ? 1 : 0,
                    adjustmentType: hasRelatedBilling ? "addition" : null,
                    adjustedBy: hasRelatedBilling ? employeeid || this.payload.employeeid : null,
                    adjustmentdate: hasRelatedBilling ? new Date() : null,
                    adjustmentReason: hasRelatedBilling ? 'New Billing service added' : null,
                    relatedBillingId: hasRelatedBilling ? parseInt(this.payload.billingid) : null,
                    writeoff: writeOffOutstanding ? writeOffAmount : 0,
                    lastupdatedby: employeeid || this.payload.employeeid,
                };
                let AdditionAdjustmentBillingData = null;
                if (isAdjustment && adjustmentType === "addition" && this.payload.billingid) {
                    let previousTransaction = await trx("billing").where({ billingid: this.payload.billingid }).first();
                    if (previousTransaction) {
                        const previousOutstanding = previousTransaction.outstanding || 0;
                        const newOutstanding = parseFloat(previousOutstanding) + parseFloat(dataToUpdate.outstanding.toString());
                        const previousAmountPayable = previousTransaction.payable || 0;
                        const newAmountPayable = parseFloat(previousAmountPayable) + dataToUpdate.payable;
                        const previousTotalCost = previousTransaction.totalcost || 0;
                        const newTotalCost = parseFloat(previousTotalCost) + dataToUpdate.totalcost;
                        const previousPaid = previousTransaction.paid || 0;
                        const previousTotalTransactionCost = previousTransaction.totalTransactionCost || 0;
                        const newTotalTransactionCost = parseFloat(previousTotalTransactionCost) + dataToUpdate.totalTransactionCost;
                        const previousDiscount = previousTransaction.discount || 0;
                        const newDiscount = parseFloat(previousDiscount) + dataToUpdate.discount;
                        const newPaid = parseFloat(previousPaid) + dataToUpdate.paid;
                        const previousBalance = previousTransaction.balance || 0;
                        const newBalance = previousBalance + dataToUpdate.balance;
                        const previousRefunded = previousTransaction.totalrefunded || 0;
                        const newRefunded = parseFloat(previousRefunded) + dataToUpdate.totalrefunded || 0;
                        const previousAmmountIncurredDueTax = previousTransaction.amountIncurredDueTax || 0;
                        const newAmmountIncurredDueTax = parseFloat(previousAmmountIncurredDueTax) + dataToUpdate.amountIncurredDueTax;
                        const adjustmentReason = this.payload.adjustmentReason || 'Addition of new services/tests';
                        const totalsurcharges = parseFloat(previousTransaction.surcharges || 0) + parseFloat(dataToUpdate.surcharges || 0);
                        let newStatus = "pending";
                        if (newPaid >= newAmountPayable) {
                            newStatus = "paid";
                        }
                        else if (newPaid > 0 && newPaid < newAmountPayable) {
                            newStatus = "partial";
                        }
                        AdditionAdjustmentBillingData = {
                            totalcost: newTotalCost,
                            totalTransactionCost: newTotalTransactionCost,
                            totalrefunded: newRefunded,
                            discount: newDiscount,
                            paid: newPaid,
                            payable: newAmountPayable,
                            outstanding: newOutstanding,
                            balance: newBalance,
                            status: newStatus,
                            amountIncurredDueTax: newAmmountIncurredDueTax,
                            branchid: updatedBillingData.branchid,
                            isPromo: updateData.isPromo,
                            promoValue: updateData.promoValue,
                            additionalinformation: this.payload.additioninformation || null,
                            promoMethod: updateData.promoMethod ? updateData.promoMethod : null,
                            promoCodeId: updateData.promoCodeId ? updateData.promoCodeId : null,
                            isAdjustment: hasRelatedBilling ? 1 : 0,
                            adjustmentType: hasRelatedBilling ? "addition" : null,
                            adjustedBy: hasRelatedBilling ? employeeid || this.payload.employeeid : null,
                            adjustmentdate: hasRelatedBilling ? new Date() : null,
                            adjustmentReason,
                            relatedBillingId: hasRelatedBilling ? parseInt(this.payload.billingid) : null,
                            writeoff: writeOffOutstanding ? writeOffAmount : 0,
                            patientid: updatedBillingData.patientId,
                            lastupdatedby: employeeid || this.payload.employeeid,
                            surcharges: totalsurcharges,
                        };
                    }
                }
                const finalUpdateData = hasRelatedBilling && adjustmentType == "addition" ? AdditionAdjustmentBillingData : dataToUpdate;
                const finalBillingId = hasRelatedBilling && adjustmentType == "addition" ? parseInt(this.payload.billingid) : billingID;
                finalBillingIdForEvent = finalBillingId;
                const result = await trx("billing")
                    .update(Object.assign(Object.assign({}, finalUpdateData), { billedon: billeddate ? billeddate : new Date() }))
                    .where({ billingid: finalBillingId });
                if (!result)
                    throw new Error("unable to update billing record");
                if (data.isPromo && data.promoCode && data.promoDetails.id) {
                    const promoRepo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(this.tenantId);
                    await promoRepo.incrementUsage(data.promoDetails.id, trx);
                }
                const paymentsArr = Array.isArray(this.payload.payments) ? this.payload.payments : [];
                if (paymentsArr.length > 0) {
                    for (const payment of paymentsArr) {
                        const paymentMode = payment.mode;
                        const paymentAmount = payment.amount;
                        const employeeId = payment.employeeid || this.payload.employeeid;
                        if (!paymentMode || !employeeId) {
                            throw new Error("Missing mode or employeeid in payment record.");
                        }
                        await billing_shared_1.BillingSharedRepo.insertBillHistory(this.tenantId, trx, billingID, paymentMode, paymentAmount, employeeId, "credit");
                    }
                }
                if ([2, 4, 6].includes(billingSource)) {
                    await SubmitCustomerBilling.triggerCommissionCalculation(tenantId, finalBillingIdForEvent || billingID, trx);
                }
                await trx.commit();
            }
            catch (error) {
                try {
                    await trx.rollback();
                }
                catch (_d) { }
                throw error;
            }
            const parsedEmployeeId = parseInt((employeeid || this.payload.employeeid).toString(), 10);
            const repo = new PrimeEventsDataSource_1.PrimeEventsSMSDataSource(tenantId);
            await repo.paymentConfirmationEvent(tenantId, finalBillingIdForEvent || billingID, parsedEmployeeId);
            return { status: true, message: "Order submitted successfully", billingid: billingID };
        }
        catch (error) {
            return { status: false, message: error && error.message ? error.message : "Unknown error in billing submission" };
        }
    }
    /**
     * Trigger commission calculation for all services in a billing
     * Called after successful billing submission to calculate and store commissions
     */
    static async triggerCommissionCalculation(tenantId, billingId, trx) {
        try {
            const connection = await trx ? trx : (0, KnexConnections_1.default)(tenantId);
            // Get all services for this billing
            const services = await connection('dboservices')
                .where({ billingid: billingId })
                .select('serviceid', 'paidamount', 'clinicianId', 'organizationId', 'serviceCategory');
            if (!services || services.length === 0) {
                commission_configurations_1.CommissionLogger.warn('No services found for commission calculation', { billingid: billingId });
                return;
            }
            // Create commission engine
            const engine = commission_configurations_1.CommissionServiceFactory.createEngine(tenantId);
            // Calculate commission for each service
            for (const service of services) {
                try {
                    const result = await engine.executeCommissionCalculation({
                        service_id: service.serviceid,
                        service_amount: service.paidamount || 0,
                        clinician_id: service.clinicianId || null,
                        organization_id: service.organizationId || null,
                        service_category: service.serviceCategory || '',
                        completion_date: service.created_at || new Date(),
                    });
                    if (result.reason === 'SUCCESS') {
                        commission_configurations_1.CommissionLogger.info('Commission calculated successfully', {
                            service_id: service.serviceid,
                            tracking_id: result.tracking_id,
                            amount: result.final_commission,
                        });
                    }
                    else if (result.reason === 'NO_CONFIG') {
                        commission_configurations_1.CommissionLogger.warn('No commission configuration found for service', {
                            service_id: service.serviceid,
                            clinician_id: service.clinicianId,
                            organization_id: service.organizationId,
                            service_category: service.serviceCategory,
                        });
                    }
                    else {
                        commission_configurations_1.CommissionLogger.error('Commission calculation failed', {
                            service_id: service.serviceid,
                            reason: result.reason,
                            error: result.error,
                        });
                    }
                }
                catch (error) {
                    commission_configurations_1.CommissionLogger.error('Error calculating commission for service', {
                        service_id: service.serviceid,
                        error: error.message,
                    });
                }
            }
            commission_configurations_1.CommissionLogger.info('Commission calculation completed for billing', {
                billingid: billingId,
                service_count: services.length,
            });
        }
        catch (error) {
            commission_configurations_1.CommissionLogger.error('Failed to trigger commission calculation', {
                billingid: billingId,
                error: error.message,
            });
            trx ? await trx.rollback() : null;
            throw error;
        }
    }
    static async validateBillingRequestBody(billingData, tenantId) {
        const { cart, servicesProvided, employeeid, branchid, isPromo, promo, patientId, amountPayable, paid, payments } = billingData;
        if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
            return billingclientTypes_1.ValidationError.CartAndServicesNotArrays;
        }
        if (cart.length === 0 && servicesProvided.length === 0) {
            return billingclientTypes_1.ValidationError.CartAndServicesEmpty;
        }
        if (!employeeid || typeof employeeid !== "number") {
            return billingclientTypes_1.ValidationError.InvalidEmployeeId;
        }
        if (!branchid || typeof branchid !== "number") {
            return billingclientTypes_1.ValidationError.InvalidBranchId;
        }
        if (typeof amountPayable !== "number" || typeof paid !== "number") {
            return billingclientTypes_1.ValidationError.InvalidAmounts;
        }
        if (!patientId || typeof patientId !== "number") {
            return billingclientTypes_1.ValidationError.InvalidPatientId;
        }
        if (!(await billing_shared_1.BillingSharedRepo.checkPatientIdExist(patientId, tenantId))) {
            return billingclientTypes_1.ValidationError.PatientDoesNotExist;
        }
        if (isPromo && (!promo || !promo.code)) {
            return billingclientTypes_1.ValidationError.PromoCodeRequired;
        }
        if (payments && Array.isArray(payments)) {
            for (const payment of payments) {
                if (!payment.mode || !(await billing_shared_1.BillingSharedRepo.validatePaymentModeId(parseInt(payment.mode.toString(), 10), tenantId))) {
                    return billingclientTypes_1.ValidationError.InvalidPaymentMode;
                }
            }
        }
        return true;
    }
    static async processTestCartWithoutRecalculation(billingData, billingID, taxValue, taxIncluded, taxList = null, trx, hasRelatedBilling, relatedBillingId) {
        let entityType = "general";
        let entityId = 0;
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;
        let registrationType = "self";
        if (billingData.billingSource > 1 && billingData.billingSource != 4 && billingData.entityId) {
            entityId = parseInt(billingData.entityId.toString());
            switch (billingData.billingSource) {
                case 2:
                    entityType = "organization";
                    organizationId = entityId;
                    registrationType = "organization";
                    break;
                case 3:
                    entityType = "phis";
                    insuranceId = entityId;
                    registrationType = "phis";
                    break;
                case 6:
                    entityType = "clinician";
                    clinicianId = entityId;
                    registrationType = "clinician";
                    break;
                default:
                    registrationType = "self";
            }
        }
        else if (!billingData.billingSource || billingData.billingSource === 0) {
            registrationType = "self";
        }
        else if (billingData.billingSource === 4) {
            entityType = "nhis";
            registrationType = "nhis";
        }
        const result = await Promise.all(billingData.cart.map(async (item) => {
            var _a;
            const { paidamount, paymentstatus, outstanding } = SubmitCustomerBilling.getPaidAmountAndStatus(item);
            const newClinicianId = SubmitCustomerBilling.extractClinician(billingData);
            const newOrganizationId = SubmitCustomerBilling.extractOrganization(billingData);
            const source = billingData.billingSource;
            const userAdjustedValue = (item === null || item === void 0 ? void 0 : item.userAdjustedValue) ? parseFloat(((_a = item.userAdjustedValue) === null || _a === void 0 ? void 0 : _a.toString()) || "0") : null;
            const userAdjustmentType = (item === null || item === void 0 ? void 0 : item.userAdjustmentType) || null;
            const pricedToBeUsed = billingData.isPackageUsed ? item.cost || item.discountedValue : item.actualPrice;
            const data = {
                billingid: billingID,
                trackId: item.testid,
                cost: pricedToBeUsed,
                employeeid: billingData.employeeid,
                serviceCategory: billingclientTypes_1.serviceCategory[source],
                categoryTrackId: billingData.billingSource,
                clinicianId: newClinicianId || null,
                organizationId: newOrganizationId || null,
                registrationType,
                relatedbillingid: hasRelatedBilling ? relatedBillingId : null,
                branchid: billingData.branchid,
                isoutsourced: item.isoutsourced === 1 ? 1 : 0,
                outsourceid: item.outsourceid || null,
                serviceAddedOn: new Date(),
                taxList: typeof taxList === "string" ? taxList : null,
                taxValue,
                amountIncurredDueTax: item.amountIncurredDueTax,
                taxIncluded: taxIncluded == true ? 1 : 0,
                discount: item.discount,
                totalcost: item.totalcost,
                totalpayable: item.totalpayable,
                isNHIS: billingData.billingSource === 4 ? 1 : 0,
                isPHIS: billingData.billingSource === 3 ? 1 : 0,
                insuranceid: insuranceId,
                claimCode: null,
                hasNightAdjustment: item.hasNightAdjustment,
                nightAdjustmentMode: item.nightAdjustmentMode,
                nightAdjustmentValue: item.nightAdjustmentValue || 0,
                outstanding,
                isPackageUsed: billingData.isPackageUsed ? 1 : 0,
                packageid: billingData.packageid || null,
                paidamount,
                paymentstatus: paymentstatus,
                nhismembershipid: billingData.nhismembershipid ? billingData.nhismembershipid : null,
                claimscheckcode: billingData.claimscheckcode ? billingData.claimscheckcode : null,
                userAdjustedValue,
                userAdjustmentType
            };
            if (item.isoutsourced == 1 && item.outsourceid) {
                const result = await trx('outsourceorganizationservices')
                    .where({ outsourceid: data.outsourceid, generalTestId: item.testid })
                    .first();
                if (!result) {
                    throw new Error("Invalid outsource organization");
                }
                data['outsourceprice'] = result.outsourcePrice;
            }
            return data;
        }));
        return result;
    }
    static extractClinician(billingData) {
        if (!billingData)
            return null;
        if (billingData.entitytype == "clinician")
            return billingData.entityId || billingData.entityid;
        if (billingData.clinicianId && !isNaN(billingData.clinicianId))
            return parseInt(billingData.clinicianId.toString());
    }
    static extractOrganization(billingData) {
        if (!billingData)
            return null;
        if (billingData.entitytype == "organization")
            return billingData.entityId || billingData.entityid;
        if (billingData.organizationId && !isNaN(billingData.organizationId))
            return parseInt(billingData.organizationId.toString());
    }
    static async processNonTestServices(billingData, servicesProvided, billingID, taxValue, taxList, hasRelatedBilling, relatedBillingId) {
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;
        let registrationType = "self";
        const entityId = billingData.entityId ? parseInt(billingData.entityId.toString()) : null;
        switch (billingData.billingSource) {
            case 2:
                organizationId = entityId;
                registrationType = "organization";
                break;
            case 3:
                insuranceId = entityId;
                registrationType = "insurance";
            case 4:
                insuranceId = entityId;
                registrationType = "nhis";
                break;
            case 6:
                clinicianId = entityId;
                registrationType = "clinician";
                break;
        }
        const { employeeid, branchid, taxIncluded, billingSource, isPackageUsed } = billingData;
        const outcome = await Promise.all(servicesProvided
            .map(async (item) => {
            var _a;
            const { paidamount, paymentstatus, outstanding } = SubmitCustomerBilling.getPaidAmountAndStatus(item);
            const newClinicianId = SubmitCustomerBilling.extractClinician(billingData);
            const newOrganizationId = SubmitCustomerBilling.extractOrganization(billingData);
            const userAdjustedValue = (item === null || item === void 0 ? void 0 : item.userAdjustedValue) ? parseFloat(((_a = item.userAdjustedValue) === null || _a === void 0 ? void 0 : _a.toString()) || "0") : null;
            const userAdjustmentType = (item === null || item === void 0 ? void 0 : item.userAdjustmentType) || null;
            return {
                billingid: billingID,
                trackId: item.keyid,
                cost: item.servicePrice,
                employeeid,
                serviceCategory: billingclientTypes_1.serviceCategory[5],
                categoryTrackId: 5,
                clinicianId: newClinicianId,
                organizationId: newOrganizationId,
                registrationType,
                branchid,
                isoutsourced: 0,
                outstanding,
                outsourceid: 0,
                outsourceprice: 0,
                serviceAddedOn: new Date(),
                taxList,
                taxValue,
                relatedbillingid: hasRelatedBilling ? relatedBillingId : null,
                amountIncurredDueTax: item.amountIncurredDueTax,
                taxIncluded,
                discount: item.discount,
                totalcost: item.totalcost,
                totalpayable: item.totalpayable,
                isNHIS: billingSource === 4 ? 1 : 0,
                isPHIS: billingSource === 3 ? 1 : 0,
                insuranceid: insuranceId || null,
                claimCode: null,
                hasNightAdjustment: item.isNightTime,
                nightAdjustmentMode: item.nightAdjustmentMode,
                nightAdjustmentValue: item.nightAdjustmentValue,
                isPackageUsed: isPackageUsed ? 1 : 0,
                packageid: item.packageid || null,
                paymentstatus: paymentstatus,
                paidamount: paidamount,
                nhismembershipid: billingData.nhismembershipid ? billingData.nhismembershipid : null,
                claimscheckcode: billingData.claimscheckcode ? billingData.claimscheckcode : null,
                userAdjustedValue,
                userAdjustmentType
            };
        }));
        return outcome;
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
                    packageid,
                    nhismembershipid: item.nhismembershipid ? item.nhismembershipid : null,
                    claimscheckcode: item.claimscheckcode ? item.claimscheckcode : null,
                    relatedbillingid: item.relatedbillingid
                });
                const serviceid = typeof outcome === "number"
                    ? outcome
                    : Array.isArray(outcome)
                        ? outcome[0]
                        : outcome === null || outcome === void 0 ? void 0 : outcome.serviceid;
                if (serviceid && typeof serviceid === "number") {
                    await (0, appLevelTriggers_1.applyDboservicesAfterInsert)(queryRunner, {
                        serviceid,
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
                        packageid,
                        nhismembershipid: item.nhismembershipid ? item.nhismembershipid : null,
                        claimscheckcode: item.claimscheckcode ? item.claimscheckcode : null,
                        relatedbillingid: item.relatedbillingid
                    }, employeeid ? employeeid.toString() : undefined);
                }
                if (serviceid && item[5] != 5 && item[1]) {
                    try {
                        await billing_shared_1.BillingSharedRepo.AddtoTestAscenstion(tenantId, serviceid, billingid, item[1], queryRunner);
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
                    service.packageid,
                    service.nhismembershipid ? service.nhismembershipid : null,
                    service.claimscheckcode ? service.claimscheckcode : null
                ];
            });
            const loadAllServices = await this.loadMultipleServices(servicesMap, billingid, tenantId, trx);
            return loadAllServices;
        }
        catch (err) {
            console.log('Error Loading services ', err);
            throw err;
        }
    }
    static async removePendingNonPaidServices({ tenantId, billingid, serviceid, employeeid }) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const overalBillRecord = await connection('billing').where({ billingid }).first();
        if (!overalBillRecord)
            return "Resource not found." /* OperationsFailures.notFound */;
        let isParentBillingId = false;
        let workingBillinId = billingid;
        let isRelatedUsed = false;
        const transaction = await connection.transaction();
        try {
            const service = await transaction('dboservices')
                .where({ serviceid, billingid, paymentstatus: 'pending' })
                .first();
            if (!service) {
                return "Resource not found." /* OperationsFailures.notFound */;
            }
            const { paymentstatus, isDeleted, relatedbillingid } = service;
            if (relatedbillingid && !isNaN(relatedbillingid)) {
                isParentBillingId = true;
                workingBillinId = relatedbillingid;
                isRelatedUsed = true;
            }
            if (isDeleted === 1) {
                return "Service already deleted" /* OperationsFailures['serviceAlreadyDeleted'] */;
            }
            if (paymentstatus !== 'pending') {
                return "Service payment status is not pending,kindly request for refund if you wish to remove this service" /* OperationsFailures.serviceCannotBeRemoved */;
            }
            const shallowDeleted = await transaction('dboservices')
                .where({ serviceid })
                .update({ 'isDeleted': 1, deletedAt: new Date(), isdeletedBy: employeeid });
            const shallowDeletedService = await transaction('dboservices').where({ serviceid }).first();
            if (shallowDeletedService) {
                await (0, appLevelTriggers_1.applyDboservicesAfterUpdate)(transaction, shallowDeletedService, employeeid ? employeeid.toString() : undefined);
            }
            if (shallowDeleted) {
                const testAscensionDeletion = await transaction('test_ascension')
                    .where({ serviceid })
                    .del();
                if (!testAscensionDeletion) {
                    await transaction.rollback();
                    return "An internal server error occurred." /* OperationsFailures.internalServerError */;
                }
                const overalBillRecord = await transaction('billing')
                    .where({ billingid: workingBillinId })
                    .first();
                if (!overalBillRecord) {
                    await transaction.rollback();
                    return "Resource not found." /* OperationsFailures.notFound */;
                }
                const newTotalCost = parseFloat(overalBillRecord.totalcost.toString()) - parseFloat(service.totalcost.toString());
                const newAmountPayable = parseFloat(overalBillRecord.payable.toString()) - parseFloat(service.totalpayable.toString());
                const newOutstanding = Math.max(newAmountPayable - overalBillRecord.paid, 0);
                const newBalance = newOutstanding > 0 ? 0 : overalBillRecord.paid - newAmountPayable;
                let newStatus = 'pending';
                if (overalBillRecord.paid >= newAmountPayable) {
                    newStatus = 'paid';
                }
                const updatedBillRecord = await transaction('billing')
                    .where({ billingid: workingBillinId })
                    .update({
                    totalcost: newTotalCost,
                    payable: newAmountPayable,
                    outstanding: newOutstanding,
                    balance: newBalance,
                    status: newStatus,
                    lastupdatedby: employeeid,
                });
                if (isRelatedUsed && relatedbillingid && !isNaN(relatedbillingid)) {
                    await transaction('dboservices')
                        .update({ status: 'voided' })
                        .where({ relatedbillingid: workingBillinId, serviceid });
                }
                else {
                    await transaction('dboservices')
                        .update({ status: 'voided' })
                        .where({ billingid: workingBillinId, serviceid });
                }
                const voidedService = await transaction('dboservices').where({ serviceid }).first();
                if (voidedService) {
                    await (0, appLevelTriggers_1.applyDboservicesAfterUpdate)(transaction, voidedService, employeeid ? employeeid.toString() : undefined);
                }
                if (!updatedBillRecord) {
                    await transaction.rollback();
                    return "An internal server error occurred." /* OperationsFailures.internalServerError */;
                }
                await transaction.commit();
                return true;
            }
            else {
                await transaction.rollback();
                return "An internal server error occurred." /* OperationsFailures.internalServerError */;
            }
        }
        catch (err) {
            console.log('Error removing pending non paid service:', err);
            await transaction.rollback();
            return "An internal server error occurred." /* OperationsFailures.internalServerError */;
        }
    }
}
exports.SubmitCustomerBilling = SubmitCustomerBilling;

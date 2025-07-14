"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Refund = void 0;
/**
 * RefundClass.ts
 *
 * Handles all refund-related operations for billing and services, including initiation, verification,
 * witness management, approval, and cash-out processing. Integrates with billing, services, and user modules.
 * All methods are static and designed for transactional and role-based workflows.
 */
const queries_1 = require("./queries");
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const queries_2 = require("../services/queries");
const billing_1 = require("./billing");
const helper_1 = require("../../hooks/helper");
const services_1 = require("../services/services");
const PrimeBillingEnterprise_1 = require("./multi/PrimeBillingEnterprise");
/**
 * Refund class provides static methods for managing service and billing refunds,
 * including witness assignment, approval, and cash-out logic.
 */
class Refund {
    /**
     * Initiates a refund process for a specific service by creating a refund record and assigning the first witness.
     * @param tenantId - Tenant identifier
     * @param employeeid - Employee initiating the refund
     * @param serviceid - Service to refund
     * @param purpose - Reason for refund
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    static async initiateRefundofServices(tenantId, employeeid, serviceid, purpose) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_initiate_refund_first_witness, [
            1,
            employeeid,
            employeeid,
            purpose,
            serviceid,
        ]);
        return (0, helper_1.rowAffected)(result);
    }
    /**
     * Checks if a given employee has already been assigned as a witness for a refund.
     * @param tenantId - Tenant identifier
     * @param trackId - Service or refund track ID
     * @param employeeid - Employee to check
     * @returns {Promise<boolean>} - True if already a witness, false otherwise
     */
    static async hasWitnessRefund(tenantId, trackId, employeeid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_refunds_has_witness_before, [
            employeeid,
            employeeid,
            employeeid,
            trackId,
        ]);
        return result[0]['count'] > 0;
    }
    /**
     * Retrieves refund details for a specific service and processes them based on user role.
     * @param tenantId - Tenant identifier
     * @param serviceid - Service ID
     * @param employeeid - Employee requesting details
     * @returns {Promise<any>} - Processed refund details or access failure
     */
    static async getAserviceRefundDetails(tenantId, serviceid, employeeid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_get_a_service_refund_details, [serviceid]);
        if (result && Array.isArray(result) && result.length > 0) {
            const user = new user_1.default(null, null, null, null, null);
            const role = await user.getUserRole(employeeid, tenantId);
            if (role) {
                return await this.refundItemProcessed(tenantId, result, user, employeeid, role, 'completed');
            }
            return "You do not have permission to access this resources" /* OperationsFailures.dontHaveAccessPermission */;
        }
        return null;
    }
    /**
     * Retrieves all refunds with pagination, filtered by status and user role.
     * @param tenantId - Tenant identifier
     * @param status - Refund status ('completed' | 'pending')
     * @param count - Number of records per page
     * @param page - Page number
     * @param employeeid - Employee requesting the data
     * @returns {Promise<any>} - Paginated and processed refund data
     */
    static async getAllRefundsWithPagination(tenantId, status, count = 10, page = 1, orderDirection = 'ASC', employeeid) {
        const user = new user_1.default(null, null, null, null, null);
        const role = await user.getUserRole(employeeid, tenantId);
        let values = [];
        let query = '';
        if (role !== 'admin' && status === 'completed') {
            query = queries_2.q_refund_get_all_refunds_status_completed_employee_specific;
            values.push(employeeid);
            values.push(employeeid);
            values.push(employeeid);
        }
        else {
            query = status === 'completed'
                ? queries_2.q_refund_get_all_refunds_status_completed
                : queries_2.q_refund_get_all_refunds_status_pending;
        }
        const safeOrder = orderDirection === 'DESC' ? 'DESC' : 'ASC';
        query = query.replace('{orderDirection}', safeOrder);
        let result = await (0, helper_1.paginationQuery)({ count, page }, query, values, tenantId);
        let outcome = await Refund.refundItemProcessed(tenantId, result, user, employeeid, role, status);
        return outcome;
    }
    /**
     * Processes refund items by mapping them to witness and response structures based on user role and status.
     * @param tenantId - Tenant identifier
     * @param result - Refund data array
     * @param user - User instance
     * @param employeeid - Employee ID
     * @param role - User role
     * @param status - Refund status
     * @returns {Promise<any>} - Processed refund items
     */
    static async refundItemProcessed(tenantId, result, user, employeeid, role, status) {
        if (result.length > 0) {
            result = await Promise.all(result.map(async (item) => {
                return await Refund.serviceDifferentiatedToWithness(tenantId, item, user, employeeid, role, status);
            }));
        }
        const accessoriesBillingInformation = new billing_1.Billing(null);
        return await Promise.all(Refund.prepareServiceItemForResponseBulk(tenantId, result, accessoriesBillingInformation, role));
    }
    /**
     * Prepares refund service items for API response, including witness and admin-specific fields.
     * @param tenantId - Tenant identifier
     * @param result - Refund data array
     * @param accessoriesBillingInformation - Billing instance
     * @param role - User role
     * @returns {Promise<any[]>} - Array of formatted refund items
     */
    static prepareServiceItemForResponseBulk(tenantId, result, accessoriesBillingInformation, role) {
        return result.map(async (item) => {
            const responseData = await Refund.prepareResponseData(tenantId, accessoriesBillingInformation, item);
            if (role != 'admin') {
                return responseData;
            }
            return Object.assign(Object.assign({}, responseData), { isRefundCompleted: item.isRefundCompleted });
        });
    }
    /**
     * Prepares a single refund service item for API response, including service name and witness info.
     * @param tenantId - Tenant identifier
     * @param accessoriesBillingInformation - Billing instance
     * @param item - Refund/service/billing/witness data
     * @returns {Promise<any>} - Formatted refund item
     */
    static async prepareResponseData(tenantId, accessoriesBillingInformation, item) {
        let serviceName = '';
        const accessories = await accessoriesBillingInformation.diffentiateBilledToIndividualServices(tenantId, [item]);
        if (accessories.length > 0) {
            serviceName = accessories[0]['name'];
        }
        const responseData = {
            refundid: item.refundid,
            serviceid: item.serviceid,
            serviceCategory: item.serviceCategory,
            witnesses: item.witnesses,
            cost: item.cost,
            amountIncurredDueTax: item.amountIncurredDueTax,
            billedby: item.billedby,
            refundedby: item.refundedBy || null,
            approvalDate: item.approvalDate || null,
            serviceName,
            amountRefunded: item.amountRefunded || null,
            billingid: item.billingid,
            canwitness: item.canwitness,
            canEdit: item.canEdit,
            isRefundApproved: item.isRefundApproved
        };
        return responseData;
    }
    /**
     * Maps a refund service item to its witness structure and sets edit/witness permissions based on role and status.
     * @param tenantId - Tenant identifier
     * @param item - Refund item
     * @param user - User instance
     * @param employeeid - Employee ID
     * @param role - User role
     * @param status - Refund status
     * @returns {Promise<any>} - Refund item with witness info
     */
    static async serviceDifferentiatedToWithness(tenantId, item, user, employeeid, role, status) {
        let witnesses = await Refund.getWithnessFromServiceItem(tenantId, item, user, employeeid);
        item.canEdit = false;
        item.canwitness = false;
        if (role !== 'admin') {
            witnesses = Refund.processNonAdminServiceItem(witnesses, employeeid, status, item);
        }
        return Object.assign(Object.assign({}, item), { witnesses });
    }
    /**
     * Processes witness and edit permissions for non-admin users on a refund item.
     * @param witnesses - Array of witness info
     * @param employeeid - Employee ID
     * @param status - Refund status
     * @param item - Refund item
     * @returns {witnessedType[]} - Filtered witness info
     */
    static processNonAdminServiceItem(witnesses, employeeid, status, item) {
        if (witnesses.length > 0 && witnesses.length <= 3) {
            const hasWitnessBefore = witnesses.map((_witness) => _witness.employeeid).includes(parseInt(employeeid.toString()));
            const moreWithnessNeeded = witnesses.filter((_witness, index) => {
                return _witness.employeeid == null;
            });
            if (status === "pending") {
                if (moreWithnessNeeded.length > 0) {
                    if (!hasWitnessBefore) {
                        item.canwitness = true;
                        witnesses = [];
                        item.canEdit = false;
                    }
                    else {
                        witnesses = witnesses.filter((single) => single.employeeid == parseInt(employeeid.toString()));
                        item.canwitness = false;
                        item.canEdit = true;
                    }
                }
                else {
                    item.canwitness = false;
                    item.canEdit = false;
                    if (hasWitnessBefore) {
                        witnesses = witnesses.filter((single) => single.employeeid == parseInt(employeeid.toString()));
                    }
                    else {
                        witnesses = [];
                    }
                }
            }
            else {
                witnesses = witnesses.filter((single) => single.employeeid == parseInt(employeeid.toString())) || [];
            }
        }
        return witnesses;
    }
    /**
     * Retrieves witness information for a refund service item, including user details for each witness slot.
     * @param tenantId - Tenant identifier
     * @param item - Refund item
     * @param user - User instance
     * @param employeeid - Employee ID
     * @returns {Promise<witnessedType[]>} - Array of witness info
     */
    static async getWithnessFromServiceItem(tenantId, item, user, employeeid) {
        const { firstWitness, secondWitness, thirdWitness } = item;
        let witnesses = [];
        const witnessEntries = Object.entries({ firstWitness, secondWitness, thirdWitness });
        for (const [key, value] of witnessEntries) {
            if (value > 0) {
                const userData = await user.getUserDataById(value, tenantId);
                if (userData.length > 0) {
                    const { username, employeeid } = userData[0];
                    witnesses.push({ witness: key, name: username, message: `${item[key + 'Purpose']}`, employeeid });
                }
                else {
                    witnesses.push({ witness: key, name: 'not found', message: `${item[key + 'Purpose']}`, employeeid });
                }
            }
            else {
                witnesses.push({ witness: key, name: null, message: `${item[key + 'Purpose']}`, employeeid: null });
            }
        }
        return witnesses;
    }
    static async updateWitnessNote(data) {
        const { refundid, witnesses } = data;
    }
    static async getAllRefundInitiated(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_refund_get_all_refunds_status_pending);
    }
    static async getAllRefundCompleted(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_refund_get_all_refunds_status_completed);
    }
    static async getservicesRefundWithness(tenantId, serviceid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_services_refund_has_withness_data, [serviceid]);
    }
    static async isServiceRefundedOut(tenantId, serviceid) {
        const record = await new TiifuWorkingClass_1.TiifuWorkingClass("dbobillingrefundtable").findOne(tenantId, "serviceid", serviceid);
        if (!record)
            return null;
        const { isRefundCompleted } = record;
        return isRefundCompleted == 1;
    }
    static async withnessStatus(tenantId, serviceid) {
        const refundServiceInformation = await new TiifuWorkingClass_1.TiifuWorkingClass('dbobillingrefundtable').findOne(tenantId, 'serviceid', serviceid);
        if (!refundServiceInformation)
            return false;
        const { firstWitness, secondWitness, thirdWitness } = refundServiceInformation;
        if (firstWitness === 0)
            return 'firstWitness';
        if (secondWitness === 0)
            return 'secondWitness';
        if (thirdWitness === 0)
            return 'thirdWitness';
        if (firstWitness > 0 && secondWitness > 0 && thirdWitness > 0)
            return 'allWitnessesAssigned';
        return false;
    }
    static async updateWitnessOfRefund(tenantId, data) {
        const { serviceid, employeeid, witnesStatus, reason } = data;
        const hasWitnessBefore = await this.hasWitnessRefund(tenantId, serviceid, employeeid);
        if (hasWitnessBefore)
            return "This resource already exist" /* OperationsFailures.resourceExist */;
        if (witnesStatus)
            return await this.updateWitnessStatus(tenantId, witnesStatus, serviceid, employeeid, reason);
        return false;
    }
    static async updateWitnessStatus(tenantId, witness, serviceid, employeeid, reason) {
        const query = queries_2.q_services_refund_status_change
            .replace('{withness}', witness)
            .replace('{date}', `${witness}Date`)
            .replace('{withness}', witness);
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [employeeid, reason, serviceid]);
        return (0, helper_1.rowAffected)(result);
    }
    static async requestForServicesAsRefundWitness(tenantId, employeeid, serviceid, reason) {
        if (!serviceid ||
            !employeeid ||
            typeof serviceid !== 'number' ||
            typeof employeeid !== 'number') {
            return false;
        }
        const role = await new user_1.default(null, null, null, null, null).getUserRole(employeeid, tenantId);
        if (!role)
            return false;
        const withnessStatus = await this.withnessStatus(tenantId, serviceid);
        if (role !== 'admin' && withnessStatus && withnessStatus === 'allWitnessesAssigned') {
            return " You do not have the permission to be a third witness" /* OperationsFailures.nopermissiontobethirdwitness */;
        }
        if (role === 'admin') {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_services_refund_status_change_admin_approve, [1, employeeid, serviceid]);
            return (0, helper_1.rowAffected)(result);
        }
        return await this.updateWitnessOfRefund(tenantId, {
            serviceid,
            employeeid,
            witnesStatus: withnessStatus,
            reason,
        });
    }
    async isAmountRefundedOut(tenantId, serviceid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_2.hasAmountRefunded, [serviceid]);
        if (!result || !Array.isArray(result))
            return null;
        return result[0].count > 0;
    }
    static async approveRequestedRefund(tenantId, serviceid, employeeid, isApprove) {
        try {
            const billingData = await new TiifuWorkingClass_1.TiifuWorkingClass("dboservices").findOne(tenantId, "serviceid", serviceid);
            if (!billingData)
                return "Resource not found." /* OperationsFailures.notFound */;
            const isbillingLocked = await PrimeBillingEnterprise_1.PrimeBillingEnterprise.isBillingLocked(tenantId, billingData.billingid);
            if (isbillingLocked)
                return "Billing is locked , hence action cannot be carried out" /* OperationsFailures.billingLocked */;
            const isRefundCompleted = await this.isServiceRefundConcluded(tenantId, serviceid);
            if (isRefundCompleted)
                return "Refund already concluded for this service" /* OperationsFailures.refundAlreadyConcluded */;
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_services_refund_status_change_admin_approve, [isApprove, employeeid, serviceid]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (err) {
            throw err;
        }
    }
    static async isServiceRefundApproved(tenantId, serviceid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_services_refund_status_is_approved, [serviceid]);
        return result.length > 0;
    }
    static async isServiceRefundConcluded(tenantId, serviceid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_services_refund_status_is_completed, [serviceid]);
        return result.length > 0;
    }
    static async amountRefundableExceeded(tenantId, serviceId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_service_refundable_amount_exceeded, [serviceId]);
        if (!result || !Array.isArray(result))
            return null;
        const { totalcost, amountRefunded } = result[0];
        return amountRefunded > 0 && totalcost > 0 && amountRefunded >= totalcost ? true : false;
    }
    static async issueOutCashOutOfRefund(tenantId, records) {
        const { serviceid, employeeid, refundAmount, selectedPaymentMode, billingid } = records;
        try {
            const isApproved = await this.isServiceRefundApproved(tenantId, serviceid);
            if (!isApproved)
                return "refund request not approved hence refunding not possible" /* OperationsFailures.notapproved */;
            const isRefundAmmountExceeded = await this.amountRefundableExceeded(tenantId, serviceid);
            if (isRefundAmmountExceeded === null)
                return "Resource not found." /* OperationsFailures.notFound */;
            if (isRefundAmmountExceeded === true)
                return "Refund Amount exceeded. Hence Refund cannot be done" /* OperationsFailures.refundAmmountExceeded */;
            if (isRefundAmmountExceeded === false) {
                const approval_status = await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_service_refund_update_is_cashout, [employeeid, refundAmount, serviceid]);
                if (approval_status) {
                    await new billing_1.Billing(null).insertBillingHistory(tenantId, selectedPaymentMode, billingid, refundAmount, employeeid, "debit");
                    const is_bill_updated = await billing_1.Billing.updatePreviouslyBilledClientAfterRefundConcluded(tenantId, records);
                    return is_bill_updated;
                }
            }
            return "Unauthorized access." /* OperationsFailures.unauthorized */;
        }
        catch (err) {
            await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_service_refund_update_is_cashout, [null, 0, serviceid]);
        }
    }
    static async calculateServiceRefundableAmount(tenantId, serviceid) {
        if (!serviceid)
            return undefined;
        const serviceData = await new TiifuWorkingClass_1.TiifuWorkingClass("dboservices").findOne(tenantId, "serviceid", serviceid);
        const { totalpayable } = serviceData;
        return parseFloat(totalpayable.toString());
    }
    static async refundVerification(tenantId, serviceid, billingid) {
        const isRefundAmmountExceeded = await this.amountRefundableExceeded(tenantId, serviceid);
        if (isRefundAmmountExceeded !== false)
            return isRefundAmmountExceeded;
        if (isRefundAmmountExceeded == null)
            return "Resource not found." /* OperationsFailures.notFound */;
        const isBillingIdValid = await billing_1.Billing.checkValidityOfBillingid(tenantId, billingid);
        if (!isBillingIdValid)
            return "Resource not found." /* OperationsFailures.notFound */;
        const transactionData = await new billing_1.Billing(null).getTransactionBillData(tenantId, billingid);
        if (transactionData && Array.isArray(transactionData) && transactionData.length > 0) {
            const { paid } = transactionData[0];
            const refundableAmount = await this.calculateServiceRefundableAmount(tenantId, serviceid);
            if (refundableAmount > paid) {
                return {
                    refundableAmount: 0,
                    message: 'Amount paid is less than refundable Amount '
                };
            }
            return { refundableAmount };
        }
    }
    static async refundAllItemsOfTransaction(tenantId, billingid, employeeid, selectedPaymentMode) {
        const validity = await billing_1.Billing.checkValidityOfBillingid(tenantId, billingid);
        if (!validity)
            return "such id not found" /* OperationsFailures.unfoundID */;
        const serviceList = await services_1.Services.findAllServicesAssociatedWithBillingId(tenantId, billingid);
        const updatedValues = await Promise.all(serviceList.map(async (item) => {
            const { serviceid } = item;
            const initiate = await this.initiateRefundofServices(tenantId, employeeid, serviceid, 'Admin Refund of all transaction services');
            if (!initiate)
                return false;
            const updateWithness = await this.approveRequestedRefund(tenantId, serviceid, employeeid, 1);
            if (!updateWithness)
                throw new Error("Witness Not Found");
            const isServiceAlreadyRefunded = await this.isServiceRefundedOut(tenantId, serviceid);
            if (isServiceAlreadyRefunded == true)
                return true;
            if (isServiceAlreadyRefunded == null)
                return false;
            if (isServiceAlreadyRefunded == false) {
                const refundableAmount = await this.refundVerification(tenantId, serviceid, billingid);
                if (!refundableAmount || typeof refundableAmount !== "object" || !refundableAmount.refundableAmount)
                    return false;
                const amountToRefund = refundableAmount.refundableAmount;
                const issueOutCash = await this.issueOutCashOutOfRefund(tenantId, {
                    selectedPaymentMode,
                    serviceid,
                    employeeid,
                    billingid,
                    refundAmount: amountToRefund,
                    trackId: null,
                    name: null,
                    cost: null
                });
                return issueOutCash;
            }
        }));
        const isAllRefunded = updatedValues.some((item) => item !== false);
        // if all is refunded , we lock billing table and update islockedstatus
        if (isAllRefunded) {
            const lockBilling = await PrimeBillingEnterprise_1.PrimeBillingEnterprise.lockBillingRecord(tenantId, billingid, 'voided');
            if (!lockBilling)
                return "Resource not found." /* OperationsFailures.notFound */;
            return true;
        }
    }
}
exports.Refund = Refund;

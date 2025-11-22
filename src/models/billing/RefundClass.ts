/**
 * RefundClass.ts
 *
 * Handles all refund-related operations for billing and services, including initiation, verification,
 * witness management, approval, and cash-out processing. Integrates with billing, services, and user modules.
 * All methods are static and designed for transactional and role-based workflows.
 */
import { q_initiate_refund_first_witness } from './queries';
import { TiifuWorkingClass } from '../../database/TiifuWorkingClass';
import User from '../../LobnosAuth/user';
import { OperationsFailures } from '../operations/types';
import {
	hasAmountRefunded,
	q_get_a_service_refund_details,
	q_refund_get_all_refunds_status_completed,
	q_refund_get_all_refunds_status_completed_employee_specific,
	q_refund_get_all_refunds_status_pending,
	q_refunds_has_witness_before,
	q_service_refund_update_is_cashout,
	q_service_refundable_amount_exceeded,
	q_services_refund_has_withness_data,
	q_services_refund_status_change,
	q_services_refund_status_change_admin_approve,
	q_services_refund_status_is_approved,
	q_services_refund_status_is_completed,
} from '../services/queries';
import { PrimeLimsTablebilling, PrimeLimsTabledbobillingrefundtable, PrimeLimsTabledboservices } from '../../database/DatabaseTableSchema';
import { Billing } from './billing';
import { UpdatePreviousWitnessNoteBodyParams, updateRefundCashRequestBodyType, Witness } from '../../controllers/billing/sales/type';
import { promisifyQuery, rowAffected, paginationQuery } from '../../hooks/helper';
import { Services } from '../services/services';
import { PrimeBillingEnterprise } from './multi/PrimeBillingEnterprise';


type dbReturned = PrimeLimsTabledbobillingrefundtable & PrimeLimsTabledboservices & PrimeLimsTablebilling[];

type witnessedType = { witness: string; name: string | null; message: string | null; employeeid: number };

type combinedType = dbReturned & witnessedType;

type withnessUpdatedType = combinedType & { canwitness: boolean; canEdit: boolean };

/**
 * Refund class provides static methods for managing service and billing refunds,
 * including witness assignment, approval, and cash-out logic.
 */
export class Refund {
	/**
	 * Initiates a refund process for a specific service by creating a refund record and assigning the first witness.
	 * @param tenantId - Tenant identifier
	 * @param employeeid - Employee initiating the refund
	 * @param serviceid - Service to refund
	 * @param purpose - Reason for refund
	 * @returns {Promise<boolean>} - True if successful, false otherwise
	 */
	static async initiateRefundofServices(
		tenantId: number,
		employeeid: number,
		serviceid: number,
		purpose: string
	) {
		const result = await promisifyQuery(tenantId, q_initiate_refund_first_witness, [
			1,
			employeeid,
			employeeid,
			purpose,
			serviceid,
		]);
		return rowAffected(result);
	}

	/**
	 * Checks if a given employee has already been assigned as a witness for a refund.
	 * @param tenantId - Tenant identifier
	 * @param trackId - Service or refund track ID
	 * @param employeeid - Employee to check
	 * @returns {Promise<boolean>} - True if already a witness, false otherwise
	 */
	private static async hasWitnessRefund(
		tenantId: number,
		trackId: number,
		employeeid: number
	): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_refunds_has_witness_before, [
			employeeid,
			employeeid,
			employeeid,
			trackId,
		]);
		return result[0]['count'] > 0
	}

	/**
	 * Retrieves refund details for a specific service and processes them based on user role.
	 * @param tenantId - Tenant identifier
	 * @param serviceid - Service ID
	 * @param employeeid - Employee requesting details
	 * @returns {Promise<any>} - Processed refund details or access failure
	 */
	static async getAserviceRefundDetails(tenantId: number, serviceid: number, employeeid: number) {
		const result = await promisifyQuery(tenantId, q_get_a_service_refund_details, [serviceid]);

		if (result && Array.isArray(result) && result.length > 0) {
			const user = new User(null, null, null, null, null);
			const role = await user.getUserRole(employeeid, tenantId);
			if (role) {
				return await this.refundItemProcessed(tenantId, result, user, employeeid, role, 'completed');
			}
			return OperationsFailures.dontHaveAccessPermission
		}
		return null
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
	public static async getAllRefundsWithPagination(
		tenantId: number,
		status: 'completed' | 'pending',
		count: number = 10,
		page: number = 1,
		orderDirection: 'ASC' | 'DESC' = 'ASC',
		employeeid: number
	) {
		const user = new User(null, null, null, null, null);
		const role = await user.getUserRole(employeeid, tenantId);
		let values = [];
		let query = '';
		if (role !== 'admin' && status === 'completed') {
			query = q_refund_get_all_refunds_status_completed_employee_specific;
			values.push(employeeid);
			values.push(employeeid);
			values.push(employeeid);
		} else {
			query = status === 'completed'
				? q_refund_get_all_refunds_status_completed
				: q_refund_get_all_refunds_status_pending;
		}

		const safeOrder = orderDirection === 'DESC' ? 'DESC' : 'ASC';
		query = query.replace('{orderDirection}', safeOrder);

		let result: dbReturned[] | combinedType[] = await paginationQuery({ count, page }, query, values, tenantId);

		let outcome = await Refund.refundItemProcessed(tenantId, result, user, employeeid, role, status)
		return outcome
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
	private static async refundItemProcessed(tenantId: number, result: dbReturned[] | combinedType[], user: User, employeeid: number, role: string, status: string) {
		if (result.length > 0) {
			result = await Promise.all(
				result.map(async (item: withnessUpdatedType) => {
					return await Refund.serviceDifferentiatedToWithness(tenantId, item, user, employeeid, role, status);
				})
			);
		}

		const accessoriesBillingInformation = new Billing(null);
		return await Promise.all(Refund.prepareServiceItemForResponseBulk(tenantId, result, accessoriesBillingInformation, role))
	}

	/**
	 * Prepares refund service items for API response, including witness and admin-specific fields.
	 * @param tenantId - Tenant identifier
	 * @param result - Refund data array
	 * @param accessoriesBillingInformation - Billing instance
	 * @param role - User role
	 * @returns {Promise<any[]>} - Array of formatted refund items
	 */
	private static prepareServiceItemForResponseBulk(tenantId: number, result: dbReturned[] | combinedType[], accessoriesBillingInformation: Billing, role: string): Promise<{ refundid: number; serviceid: number; serviceCategory: string; witnesses: withnessUpdatedType; cost: number; amountIncurredDueTax: number; billedby: string; serviceName: string; billingid: number; canwitness: boolean; canEdit: boolean; isRefundApproved: number; } | { isRefundCompleted: number; refundid: number; serviceid: number; serviceCategory: string; witnesses: withnessUpdatedType; cost: number; amountIncurredDueTax: number; billedby: string; serviceName: string; billingid: number; canwitness: boolean; canEdit: boolean; isRefundApproved: number; }>[] {
		return result.map(async (item: combinedType & { witnesses: withnessUpdatedType; billedby: string; canwitness: boolean; canEdit: boolean; }) => {
			const responseData = await Refund.prepareResponseData(tenantId, accessoriesBillingInformation, item);

			if (role != 'admin') {
				return responseData;
			}
			return { ...responseData, isRefundCompleted: item.isRefundCompleted };
		});
	}

	/**
	 * Prepares a single refund service item for API response, including service name and witness info.
	 * @param tenantId - Tenant identifier
	 * @param accessoriesBillingInformation - Billing instance
	 * @param item - Refund/service/billing/witness data
	 * @returns {Promise<any>} - Formatted refund item
	 */
	private static async prepareResponseData(tenantId: number, accessoriesBillingInformation: Billing, item: PrimeLimsTabledbobillingrefundtable & PrimeLimsTabledboservices & PrimeLimsTablebilling[] & witnessedType & { witnesses: withnessUpdatedType; billedby: string; canwitness: boolean; canEdit: boolean; }) {
		let serviceName: string = '';
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
	private static async serviceDifferentiatedToWithness(tenantId: number, item: withnessUpdatedType, user: User, employeeid: number, role: string, status: string) {
		let witnesses: witnessedType[] = await Refund.getWithnessFromServiceItem(tenantId, item, user, employeeid);
		item.canEdit = false;
		item.canwitness = false;
		if (role !== 'admin') {
			witnesses = Refund.processNonAdminServiceItem(witnesses, employeeid, status, item);
		}

		return { ...item, witnesses };
	}

	/**
	 * Processes witness and edit permissions for non-admin users on a refund item.
	 * @param witnesses - Array of witness info
	 * @param employeeid - Employee ID
	 * @param status - Refund status
	 * @param item - Refund item
	 * @returns {witnessedType[]} - Filtered witness info
	 */
	private static processNonAdminServiceItem(witnesses: witnessedType[], employeeid: number, status: string, item: withnessUpdatedType) {
		if (witnesses.length > 0 && witnesses.length <= 3) {
			const hasWitnessBefore = witnesses.map((_witness) => _witness.employeeid).includes(parseInt(employeeid.toString()));

			const moreWithnessNeeded = witnesses.filter((_witness: Witness, index: number) => {
				return _witness.employeeid == null;
			});

			if (status === "pending") {
				if (moreWithnessNeeded.length > 0) {
					if (!hasWitnessBefore) {
						item.canwitness = true;
						witnesses = [];
						item.canEdit = false;
					} else {
						witnesses = witnesses.filter((single) => single.employeeid == parseInt(employeeid.toString()));
						item.canwitness = false;
						item.canEdit = true;
					}
				} else {
					item.canwitness = false;
					item.canEdit = false;
					if (hasWitnessBefore) {
						witnesses = witnesses.filter((single) => single.employeeid == parseInt(employeeid.toString()));
					} else {
						witnesses = [];
					}
				}
			} else {
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
	private static async getWithnessFromServiceItem(tenantId: number, item: withnessUpdatedType, user: User, employeeid: number) {
		const { firstWitness, secondWitness, thirdWitness } = item;
		let witnesses: witnessedType[] = [];
		const witnessEntries = Object.entries({ firstWitness, secondWitness, thirdWitness });

		for (const [key, value] of witnessEntries) {
			if (value > 0) {
				const userData = await user.getUserDataById(value, tenantId);
				if (userData.length > 0) {
					const { username, employeeid } = userData[0];
					witnesses.push({ witness: key, name: username, message: `${item[key + 'Purpose']}`, employeeid });
				} else {
					witnesses.push({ witness: key, name: 'not found', message: `${item[key + 'Purpose']}`, employeeid });
				}
			} else {
				witnesses.push({ witness: key, name: null, message: `${item[key + 'Purpose']}`, employeeid: null });
			}
		}
		return witnesses;
	}

	public static async updateWitnessNote(data: UpdatePreviousWitnessNoteBodyParams) {
		const { refundid, witnesses } = data;
	}
	private static async getAllRefundInitiated(tenantId: number) {
		return await promisifyQuery(tenantId, q_refund_get_all_refunds_status_pending);
	}

	private static async getAllRefundCompleted(tenantId: number) {
		return await promisifyQuery(tenantId, q_refund_get_all_refunds_status_completed);
	}

	public static async getservicesRefundWithness(tenantId: number, serviceid: number) {
		return await promisifyQuery(tenantId, q_services_refund_has_withness_data, [serviceid]);
	}

	public static async isServiceRefundedOut(tenantId: number, serviceid: number): Promise<boolean | null> {
		const record: PrimeLimsTabledbobillingrefundtable = await new TiifuWorkingClass("dbobillingrefundtable").findOne(tenantId, "serviceid", serviceid);
		if (!record) return null;
		const { isRefundCompleted } = record;
		return isRefundCompleted == 1;
	}

	private static async withnessStatus(tenantId: number, serviceid: number) {
		const refundServiceInformation = await new TiifuWorkingClass(
			'dbobillingrefundtable'
		).findOne(tenantId, 'serviceid', serviceid);

		if (!refundServiceInformation) return false;
		const { firstWitness, secondWitness, thirdWitness } = refundServiceInformation;

		if (firstWitness === 0) return 'firstWitness';
		if (secondWitness === 0) return 'secondWitness';
		if (thirdWitness === 0) return 'thirdWitness';
		if (firstWitness > 0 && secondWitness > 0 && thirdWitness > 0) return 'allWitnessesAssigned';
		return false;
	}


	private static async updateWitnessOfRefund(tenantId: number, data: {
		serviceid: number;
		employeeid: number;
		witnesStatus: string;
		reason: string;
	}): Promise<boolean | string> {
		const { serviceid, employeeid, witnesStatus, reason } = data;
		const hasWitnessBefore = await this.hasWitnessRefund(tenantId, serviceid, employeeid)
		if (hasWitnessBefore) return OperationsFailures.resourceExist
		if (witnesStatus) return await this.updateWitnessStatus(tenantId, witnesStatus, serviceid, employeeid, reason)
		return false;
	}

	static async updateWitnessStatus(
		tenantId: number,
		witness: string,
		serviceid: number,
		employeeid: number,
		reason: string
	): Promise<boolean> {
		const query = q_services_refund_status_change
			.replace('{withness}', witness)
			.replace('{date}', `${witness}Date`)
			.replace('{withness}', witness);
		const result = await promisifyQuery(tenantId, query, [employeeid, reason, serviceid]);
		return rowAffected(result);
	}

	public static async requestForServicesAsRefundWitness(
		tenantId: number,
		employeeid: number,
		serviceid: number,
		reason: string
	): Promise<boolean | string> {
		if (
			!serviceid ||
			!employeeid ||
			typeof serviceid !== 'number' ||
			typeof employeeid !== 'number'
		) {
			return false;
		}

		const role = await new User(null, null, null, null, null).getUserRole(employeeid, tenantId);
		if (!role) return false;

		const withnessStatus = await this.withnessStatus(tenantId, serviceid);

		if (role !== 'admin' && withnessStatus && withnessStatus === 'allWitnessesAssigned') {
			return OperationsFailures.nopermissiontobethirdwitness;
		}

		if (role === 'admin') {
			const result = await promisifyQuery(tenantId, q_services_refund_status_change_admin_approve, [1, employeeid, serviceid]);
			return rowAffected(result);
		}

		return await this.updateWitnessOfRefund(
			tenantId, {
			serviceid,
			employeeid,
			witnesStatus: withnessStatus as string,
			reason,
		});
	}

	async isAmountRefundedOut(tenantId: number, serviceid: number): Promise<boolean | null> {
		const result = await promisifyQuery(tenantId, hasAmountRefunded, [serviceid]);
		if (!result || !Array.isArray(result)) return null;
		return result[0].count > 0;
	}

	static async approveRequestedRefund(tenantId: number, serviceid: number, employeeid: number, isApprove: number) {
		try {

			const billingData: PrimeLimsTabledboservices = await new TiifuWorkingClass("dboservices").findOne(tenantId, "serviceid", serviceid);
			if (!billingData) return OperationsFailures.notFound;
			const isbillingLocked = await PrimeBillingEnterprise.isBillingLocked(tenantId, billingData.billingid);
			if (isbillingLocked) return OperationsFailures.billingLocked;
			const isRefundCompleted = await this.isServiceRefundConcluded(tenantId, serviceid);
			if (isRefundCompleted) return OperationsFailures.refundAlreadyConcluded;
			const result = await promisifyQuery(tenantId, q_services_refund_status_change_admin_approve, [isApprove, employeeid, serviceid]);
			return rowAffected(result);
		} catch (err) {
			throw err;
		}
	}

	static async isServiceRefundApproved(tenantId: number, serviceid: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_services_refund_status_is_approved, [serviceid]);
		return result.length > 0;
	}

	static async isServiceRefundConcluded(tenantId: number, serviceid: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_services_refund_status_is_completed, [serviceid]);
		return result.length > 0;
	}

	private static async amountRefundableExceeded(tenantId: number, serviceId: number): Promise<boolean | null> {
		const result: (PrimeLimsTabledboservices & PrimeLimsTabledbobillingrefundtable)[] = await promisifyQuery(tenantId, q_service_refundable_amount_exceeded, [serviceId]);
		if (!result || !Array.isArray(result)) return null;
		const { totalcost, amountRefunded } = result[0];
		return amountRefunded > 0 && totalcost > 0 && amountRefunded >= totalcost ? true : false;
	}

	static async issueOutCashOutOfRefund(tenantId: number, records: updateRefundCashRequestBodyType) {
		const { serviceid, employeeid, refundAmount, selectedPaymentMode, billingid } = records;
		try {
			const isApproved = await this.isServiceRefundApproved(tenantId, serviceid);
			if (!isApproved) return OperationsFailures.notapproved;

			const isRefundAmmountExceeded = await this.amountRefundableExceeded(tenantId, serviceid);
			if (isRefundAmmountExceeded === null) return OperationsFailures.notFound;
			if (isRefundAmmountExceeded === true) return OperationsFailures.refundAmmountExceeded;

			if (isRefundAmmountExceeded === false) {
				return await Billing.updatePreviouslyBilledClientAfterRefundConcluded(tenantId, records);
			}

			return OperationsFailures.unauthorized;
		} catch (err) {
			await promisifyQuery(tenantId, q_service_refund_update_is_cashout, [null, 0, serviceid]);
		}
	}

	static async calculateServiceRefundableAmount(tenantId: number, serviceid: number) {
		if (!serviceid) return undefined;

		const serviceData: PrimeLimsTabledboservices = await new TiifuWorkingClass("dboservices").findOne(tenantId, "serviceid", serviceid);
		const { totalpayable } = serviceData
		return parseFloat(totalpayable.toString());
	}


	static async refundVerification(tenantId: number, serviceid: number, billingid: number) {
		const isRefundAmmountExceeded = await this.amountRefundableExceeded(tenantId, serviceid);

		if (isRefundAmmountExceeded !== false) return isRefundAmmountExceeded;

		if (isRefundAmmountExceeded == null) return OperationsFailures.notFound;

		const isBillingIdValid = await Billing.checkValidityOfBillingid(tenantId, billingid);

		if (!isBillingIdValid) return OperationsFailures.notFound;

		const transactionData = await new Billing(null).getTransactionBillData(tenantId, billingid);

		if (transactionData && Array.isArray(transactionData) && transactionData.length > 0) {
			const { paid } = transactionData[0];

			const refundableAmount = await this.calculateServiceRefundableAmount(tenantId, serviceid);

			if (refundableAmount > paid) {
				return {
					refundableAmount: 0,
					message: 'Amount paid is less than refundable Amount '
				}
			}
			return { refundableAmount }
		}

	}

	static async refundAllItemsOfTransaction(tenantId: number, billingid: number, employeeid: number, selectedPaymentMode: number): Promise<boolean | string> {
		const validity = await Billing.checkValidityOfBillingid(tenantId, billingid);
		if (!validity) return OperationsFailures.unfoundID;

		const serviceList: PrimeLimsTabledboservices[] = await Services.findAllServicesAssociatedWithBillingId(tenantId, billingid);

		const updatedValues = await Promise.all(serviceList.map(async (item: PrimeLimsTabledboservices) => {
			const { serviceid } = item;
			const initiate = await this.initiateRefundofServices(tenantId, employeeid, serviceid, 'Admin Refund of all transaction services');
			if (!initiate) return false;

			const updateWithness = await this.approveRequestedRefund(tenantId, serviceid, employeeid, 1);
			if (!updateWithness) throw new Error("Witness Not Found");

			const isServiceAlreadyRefunded = await this.isServiceRefundedOut(tenantId, serviceid);

			if (isServiceAlreadyRefunded == true) return true;
			if (isServiceAlreadyRefunded == null) return false;

			if (isServiceAlreadyRefunded == false) {
				const refundableAmount = await this.refundVerification(tenantId, serviceid, billingid);
				if (!refundableAmount || typeof refundableAmount !== "object" || !refundableAmount.refundableAmount) return false;

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
			const lockBilling = await PrimeBillingEnterprise.lockBillingRecord(tenantId, billingid, 'voided');
			if (!lockBilling) return OperationsFailures.notFound;
			return true;
		}
	}
}





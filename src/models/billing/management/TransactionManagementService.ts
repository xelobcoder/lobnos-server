import { TransactionManagementRepository } from "./TransactionManagementRepository";
import {
    IBillingUpdate,
    IServiceUpdate,
    IPaymentHistoryUpdate,
    IAuditEntry,
    IFullTransactionHistory,
    IFullTransactionDetails
} from "./TransactionManagementTypes";
import { WriteOff } from "../WriteOff";
import { lockMutableBill } from '../BillingFinancialGuard';
import { billingFingerprint, billingRequestKey } from '../BillingRequestIdentity';
import { minorUnits } from '../../../accountingModule/utils/money';
import { enqueueBillingPayment, enqueueBillingRefund } from '../../../accountingModule/integrations/BillingAccounting';

export class TransactionManagementService {
    private repository: TransactionManagementRepository;
    private tenantId: number;

    constructor(repository: TransactionManagementRepository, tenantId: number) {
        this.repository = repository;
        this.tenantId = tenantId;
    }

    /**
     * Get the absolute full details of a transaction including joins and audit
     */
    async getFullTransactionDetails(billingId: number): Promise<IFullTransactionDetails> {
        const [billing, services, paymentHistory, auditTrail] = await Promise.all([
            this.repository.getFullBillingDetails(billingId),
            this.repository.getServicesWithDetails(billingId),
            this.repository.getPaymentHistoryWithDetails(billingId),
            this.getTransactionAuditHistory(billingId)
        ]);

        if (!billing) {
            throw new Error(`Billing record with ID ${billingId} not found`);
        }

        return {
            billing,
            services,
            payment_history: paymentHistory,
            audit_trail: auditTrail
        };
    }

    /**
     * stand-alone function to update payment history of a particular transaction
     */
    async updatePaymentHistory(updates: IPaymentHistoryUpdate): Promise<any> {
        const key = billingRequestKey(updates.request_key);
        const fingerprint = billingFingerprint(updates);
        const reason = updates.reason?.trim();
        if (!reason || reason.length < 5 || reason.length > 500) throw new Error('A correction reason of 5–500 characters is required');
        const trx = await this.repository.startTransaction();
        try {
            const snapshot = await trx('billinghx').where({ KeyID: updates.KeyID }).first();
            if (!snapshot) throw new Error('Payment history record not found');
            const replay = await trx('billing_receipt_corrections').where({ request_key: key }).first();
            if (replay) {
                if (replay.fingerprint !== fingerprint) throw new Error('Correction key was used for different inputs');
                await trx.rollback(); return replay;
            }
            const bill = await lockMutableBill(trx, this.tenantId, Number(snapshot.billingid ?? snapshot.Billingid));
            if (updates.branchid !== undefined && Number(bill.branchid) !== Number(updates.branchid)) throw new Error('Branch access denied');
            const concurrentReplay = await trx('billing_receipt_corrections').where({ request_key: key }).forUpdate().first();
            if (concurrentReplay) {
                if (concurrentReplay.fingerprint !== fingerprint) throw new Error('Correction key was used for different inputs');
                await trx.rollback(); return concurrentReplay;
            }
            const current = await trx('billinghx').where({ KeyID: updates.KeyID }).forUpdate().first();
            if (!current) throw new Error(`Payment history record ${updates.KeyID} not found`);
            if (await trx('billing_receipt_corrections').where({ original_history_id: updates.KeyID }).first())
                throw new Error('This receipt already has a linked correction');
            if (String(current.type).toLowerCase() !== 'credit') throw new Error('Only received payments can be corrected');
            const amount = Number(current.Amount ?? current.amount);
            if (updates.Amount !== undefined && minorUnits(updates.Amount) !== minorUnits(amount))
                throw new Error('Amount corrections require an allocated refund or collection; receipt totals cannot be overwritten');
            if (updates.Date && String(updates.Date) !== String(current.Date))
                throw new Error('A receipt collection date is historical and cannot be changed');
            const mode = updates.PaymentMode ?? Number(current.PaymentMode ?? current.paymentmode);
            if (!await trx('paymentmodes').where({ KeyID: mode }).first()) throw new Error('Unknown payment mode');
            const billingid = Number(current.billingid ?? current.Billingid);
            const [reversal] = await trx('billinghx').insert({ billingid, paymentmode: current.PaymentMode ?? current.paymentmode,
                amount, employeeid: updates.employeeid, type: 'debit' });
            const [replacement] = await trx('billinghx').insert({ billingid, paymentmode: mode,
                amount, employeeid: updates.employeeid, type: 'credit' });
            await enqueueBillingRefund(this.tenantId, billingid, 0, amount, updates.employeeid, trx, Number(reversal), Number(current.PaymentMode ?? current.paymentmode));
            await enqueueBillingPayment(this.tenantId, Number(replacement), billingid, amount, updates.employeeid, trx);
            const correction = { request_key: key, fingerprint, original_history_id: updates.KeyID,
                reversal_history_id: Number(reversal), replacement_history_id: Number(replacement), reason, employeeid: updates.employeeid };
            await trx('billing_receipt_corrections').insert(correction);
            await trx.commit();
            return correction;
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    /**
     * Get the full audit trail/history of a transaction, showing "from-to" changes
     */
    async getTransactionAuditHistory(billingId: number): Promise<IFullTransactionHistory> {
        const [billingRaw, servicesRaw] = await Promise.all([
            this.repository.getBillingAuditRaw(billingId),
            this.repository.getServicesAuditRaw(billingId)
        ]);

        return {
            billing_history: this.formatAuditLogs(billingRaw, 'billing'),
            services_history: this.groupAndFormatServiceAudits(servicesRaw)
        };
    }

    private formatAuditLogs(rawLogs: any[], entityType: 'billing' | 'service'): IAuditEntry[] {
        const formatted: IAuditEntry[] = [];

        for (let i = 0; i < rawLogs.length; i++) {
            const current = rawLogs[i];
            const previous = i > 0 ? rawLogs[i - 1] : null;
            const changes: Record<string, { from: any; to: any }> = {};
            const excludeFields = ['audit_id', 'action_type', 'action_timestamp', 'actor', 'lastupdated'];

            Object.keys(current).forEach(key => {
                if (excludeFields.includes(key)) return;

                const currentValue = current[key];
                const previousValue = previous ? previous[key] : null;

                if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
                    changes[key] = {
                        from: previousValue,
                        to: currentValue
                    };
                }
            });

            formatted.push({
                timestamp: current.action_timestamp,
                action: current.action_type,
                actor: current.actor,
                changes,
                entity_id: current.billingid || current.serviceid,
                entity_type: entityType
            });
        }

        return formatted;
    }

    private groupAndFormatServiceAudits(servicesRaw: any[]): Record<number, IAuditEntry[]> {
        const grouped: Record<number, any[]> = {};
        servicesRaw.forEach(log => {
            if (!grouped[log.serviceid]) grouped[log.serviceid] = [];
            grouped[log.serviceid].push(log);
        });

        const formatted: Record<number, IAuditEntry[]> = {};
        Object.keys(grouped).forEach(serviceId => {
            formatted[Number(serviceId)] = this.formatAuditLogs(grouped[Number(serviceId)], 'service');
        });

        return formatted;
    }

    /**
     * Edit a transaction's billing and services
     */
    async editTransaction(billingUpdate: IBillingUpdate, serviceUpdates: IServiceUpdate[]): Promise<boolean> {
        const trx = await this.repository.startTransaction();
        try {
            await lockMutableBill(trx, this.tenantId, billingUpdate.billingid);
            if (serviceUpdates.length || Object.keys(billingUpdate.updates || {}).some(key => key !== 'additionalinformation'))
                throw new Error('Direct financial edits are disabled; use validated additions, collections or linked refunds');
            if (billingUpdate.updates) {
                await this.repository.updateBilling(billingUpdate.billingid, {
                    ...billingUpdate.updates,
                    lastupdatedby: billingUpdate.employeeid
                }, trx);
            }

            for (const sUpdate of serviceUpdates) {
                await this.repository.updateService(sUpdate.serviceid, {
                    ...sUpdate.updates,
                    employeeid: sUpdate.employeeid
                }, trx);
            }

            await trx.commit();
            return true;
        } catch (error) {
            await trx.rollback();
            console.error("Error editing transaction:", error);
            throw error;
        }
    }

    /**
     * Void a transaction
     */
    async voidTransaction(billingId: number, employeeId: number): Promise<boolean> {
        const paymentHistory = await this.repository.getPaymentHistoryByBillingId(billingId);
        const paymentMode = paymentHistory.find((payment) => String(payment.type).toLowerCase() === 'credit')?.PaymentMode;
        return WriteOff.refundCompletelyTransaction(
            this.tenantId,
            employeeId,
            billingId,
            Number(paymentMode) || 1,
            'Transaction voided through transaction management.'
        );
    }
}

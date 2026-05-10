import { TransactionManagementRepository } from "./TransactionManagementRepository";
import {
    IBillingUpdate,
    IServiceUpdate,
    IPaymentHistoryUpdate,
    IAuditEntry,
    IFullTransactionHistory,
    IFullTransactionDetails
} from "./TransactionManagementTypes";

export class TransactionManagementService {
    private repository: TransactionManagementRepository;

    constructor(repository: TransactionManagementRepository) {
        this.repository = repository;
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
    async updatePaymentHistory(updates: IPaymentHistoryUpdate): Promise<boolean> {
        const trx = await this.repository.startTransaction();
        try {
            const current = await this.repository.getPaymentHistoryByKeyId(updates.KeyID);
            if (!current) throw new Error(`Payment history record ${updates.KeyID} not found`);

            await this.repository.updatePaymentHistoryRecord(updates.KeyID, {
                Amount: updates.Amount !== undefined ? updates.Amount : current.Amount,
                PaymentMode: updates.PaymentMode !== undefined ? updates.PaymentMode : current.PaymentMode,
                Date: updates.Date !== undefined ? updates.Date : current.Date,
                employeeid: updates.employeeid
            }, trx);

            // Log the change if needed (could add to a specific payment audit table if one exists)

            await trx.commit();
            return true;
        } catch (error) {
            await trx.rollback();
            console.error("Error updating payment history:", error);
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
        const trx = await this.repository.startTransaction();
        try {
            await this.repository.updateBilling(billingId, {
                status: 'voided',
                lastupdatedby: employeeId
            }, trx);

            const services = await this.repository.getServices(billingId);
            for (const service of services) {
                await this.repository.updateService(service.serviceid, {
                    status: 'voided',
                    employeeid: employeeId
                }, trx);
            }

            await trx.commit();
            return true;
        } catch (error) {
            await trx.rollback();
            console.error("Error voiding transaction:", error);
            throw error;
        }
    }
}

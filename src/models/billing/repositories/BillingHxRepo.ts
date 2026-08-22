import { PrimeLimsTablebilling } from "../../../database/DatabaseTableSchema";
import KnexConnection from "../../../database/KnexConnections";

export interface IBillingHx {
    KeyID: number;
    Billingid: number;
    PaymentMode: number;
    Amount: number;
    employeeid: number;
    type: 'debit' | 'credit';
}

export class BillingHxRepo {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(historyData: Omit<IBillingHx, 'KeyID'>) {
        try {
            return this.connection('billinghx')
                .insert(historyData);
        } catch (error) {
            console.error('Billing history creation error:', error);
            throw error;
        }
    }

    async update(KeyID: number, updates: Partial<IBillingHx>) {
        try {
            return this.connection('billinghx')
                .where({ KeyID })
                .update(updates);
        } catch (error) {
            console.error('Billing history update error:', error);
            throw error;
        }
    }

    async findByBillingId(billingId: number) {
        try {
            return this.connection('billinghx')
                .where({ Billingid: billingId });
        } catch (error) {
            console.error('Billing history find error:', error);
            throw error;
        }
    }

    async createBillingWithHistory(billingData: PrimeLimsTablebilling, historyData: IBillingHx) {
        const trx = await this.connection.transaction();
        try {
            const [billingId] = await trx('billing')
                .insert(billingData);

            const historyWithBillingId = { ...historyData, Billingid: billingId };
            await trx('billinghx').insert(historyWithBillingId);

            await trx.commit();
            return billingId;
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }
}
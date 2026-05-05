import KnexConnection from "../../database/KnexConnections";

export interface IClinicianPayment {
    id?: number;
    clinicianid: number;
    module: string;
    momo?: number;
    bankname?: string;
    bankbranch?: string;
    accountnumber?: number;
    accountname?: string;
    updated_on?: Date;
    created_on: Date;
    commission?: number;
    momoname?: string;
    [key: string]: any;
}

interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

export class ClinicianPaymentRepository {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(paymentData: IClinicianPayment, trx?: any): Promise<boolean> {
        try {
            const conn = trx || await this.connection;
            const [id] = await conn('clinicianpaymentinfo')
                .insert(paymentData);
            return id > 0;
        } catch (error) {
            console.error('Clinician payment creation error:', error);
            throw error;
        }
    }

    async findById(id: number): Promise<IClinicianPayment | null> {
        try {
            const conn = await this.connection;
            return await conn('clinicianpaymentinfo')
                .where({ clinicianid: id })
                .first();
        } catch (error) {
            console.error('Clinician payment find error:', error);
            throw error;
        }
    }

    async findByClinicianId(clinicianId: number): Promise<IClinicianPayment[]> {
        try {
            const conn = await this.connection;
            return await conn('clinicianpaymentinfo')
                .where({ clinicianid: clinicianId })
                .orderBy('created_on', 'desc');
        } catch (error) {
            console.error('Clinician payment find by clinician error:', error);
            throw error;
        }
    }

    async findByClinicianIdWithBasicInfo(clinicianId: number): Promise<(IClinicianPayment & { name: string, email: string, phone: string })[]> {
        try {
            const conn = await this.connection;
            return await conn('clinicianpaymentinfo')
                .join('clinicianbasicinfo', 'clinicianpaymentinfo.clinicianid', '=', 'clinicianbasicinfo.id')
                .select('clinicianpaymentinfo.*', 'clinicianbasicinfo.name', 'clinicianbasicinfo.email', 'clinicianbasicinfo.phone')
                .where('clinicianpaymentinfo.clinicianid', clinicianId)
                .orderBy('clinicianpaymentinfo.created_on', 'desc');
        } catch (error) {
            console.error('Clinician payment find with basic info error:', error);
            throw error;
        }
    }

    async update(clinicianid: number, updates: Partial<IClinicianPayment>): Promise<boolean> {
        try {
            const conn = await this.connection;
            const existingRecord = await conn('clinicianpaymentinfo').where({ clinicianid })
                .first();
            if (!existingRecord) {
                const clinicianBasicInfo = await conn('clinicianbasicinfo').where({ id: clinicianid }).first();
                if (clinicianBasicInfo) {
                    const newPaymentData: IClinicianPayment = {
                        clinicianid,
                        module: updates.module || 'default',
                        created_on: new Date(),
                        updated_on: new Date(),
                    };
                    const created = await this.create(newPaymentData, conn);
                    return created;
                }
                return false;
            }
            console.log('Existing record:', existingRecord);
            const result = await conn('clinicianpaymentinfo')
                .where({ clinicianid: updates.clinicianid })
                .update(updates);
            console.log('Update result:', result, updates);
            return result > 0;
        } catch (error) {
            console.error('Clinician payment update error:', error);
            throw error;
        }
    }

    async delete(id: number): Promise<boolean> {
        try {
            const conn = await this.connection;
            const result = await conn('clinicianpaymentinfo')
                .where({ id })
                .delete();
            return result > 0;
        } catch (error) {
            console.error('Clinician payment delete error:', error);
            throw error;
        }
    }
}
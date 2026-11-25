import { PrimeLimsTableprivateinsurance } from "../../interfaces/database";
import KnexConnection from "../../database/KnexConnections";

export default class InsuranceClass {
     private insuranceId: number | null;

     constructor(insuranceId: number | null = null) {
          this.insuranceId = insuranceId;
     }

     public async create(tenantId: number, data: PrimeLimsTableprivateinsurance) {
          const connection = await KnexConnection(tenantId);
          const result = await connection('privateinsurance')
               .insert({
                    insuranceName: data.insuranceName,
                    insuranceCode: data.insuranceCode,
                    insuranceType: data.insuranceType,
                    searchCode: data.searchCode,
                    network: data.network,
                    tags: data.tags,
                    mailingAddress: data.mailingAddress,
                    city: data.city,
                    state: data.state,
                    county: data.county,
                    zipCode: data.zipCode,
                    comments: data.comments
               })
               .returning('id');
          return result[0];
     }

     public async read(tenantId: number) {
          const connection = await KnexConnection(tenantId);
          if (this.insuranceId) {
               const result = await connection('privateinsurance')
                    .where('id', this.insuranceId)
                    .first();
               return result;
          }
          const result = await connection('privateinsurance').select('*');
          return result;
     }

     public async getInsuranceById(tenantId: number, insuranceId: number) {
          const connection = await KnexConnection(tenantId);
          const result = await connection('privateinsurance')
               .where('id', insuranceId)
               .first();
          return result;
     }

     public async checkInsuranceExistence(tenantId: number, insuranceId: number): Promise<boolean> {
          const result = await this.getInsuranceById(tenantId, insuranceId);
          return !!result;
     }

     public async getAllInsurances(tenantId: number, page: number = 1, pageSize: number = 10) {
          const connection = await KnexConnection(tenantId);
          const result = await connection('privateinsurance')
               .select('*')
               .limit(pageSize)
               .offset((page - 1) * pageSize);
          return result;
     }

     public async update(tenantId: number, data: PrimeLimsTableprivateinsurance) {
          if (!this.insuranceId) throw new Error("Insurance ID is required for update");
          const connection = await KnexConnection(tenantId);
          const result = await connection('privateinsurance')
               .where('id', this.insuranceId)
               .update({
                    insuranceName: data.insuranceName,
                    insuranceCode: data.insuranceCode,
                    insuranceType: data.insuranceType,
                    searchCode: data.searchCode,
                    network: data.network,
                    tags: data.tags,
                    mailingAddress: data.mailingAddress,
                    city: data.city,
                    state: data.state,
                    county: data.county,
                    zipCode: data.zipCode,
                    comments: data.comments
               });
          return result;
     }

     public async delete(tenantId: number) {
          if (!this.insuranceId) throw new Error("Insurance ID is required for delete");
          const connection = await KnexConnection(tenantId);
          const result = await connection('privateinsurance')
               .where('id', this.insuranceId)
               .del();
          return result;
     }
}

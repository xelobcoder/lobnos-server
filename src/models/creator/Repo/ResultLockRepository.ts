import KnexConnection from "../../../database/KnexConnections";


interface ResultLock {
     id?: number;
     ascensionid: number;
     isResultLock: boolean;
     created_at?: Date;
     updated_at?: Date;
}

class ResultLockRepository {
     private tenantId: number;
     private connection: any;
     private tablename: string;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
          this.tablename = 'result_lock';
     }

     async create(ascensionId: number): Promise<ResultLock> {
          const connection = await this.connection;
          const result = connection(this.tablename).insert({
               ascensionid: ascensionId,
               isResultLock: false
          })
               .returning('*');
          return result;
     }

     async getByAscensionId(ascensionId: number): Promise<ResultLock | null> {
          const connection = await this.connection;
          const resultLock = await connection(this.tablename)
               .where('ascensionid', ascensionId)
               .first()
               .returning('*');
          return resultLock || null;
     }

     async updateLockStatus(ascensionId: number, isLocked: boolean): Promise<ResultLock | null> {
          const connection = await this.connection;
          const [updatedLock] = await connection(this.tablename)
               .where('ascensionid', ascensionId)
               .update({
                    isResultLock: isLocked,
                    updated_at: connection.fn.now()
               })
               .returning('*');
          return updatedLock || null;
     }

     async delete(ascensionId: number): Promise<boolean> {
          const connection = await this.connection;
          const deleted = await connection(this.tablename)
               .where('ascensionid', ascensionId)
               .delete()
               .returning('*');
          return deleted.length > 0;
     }

     async isLocked(ascensionId: number): Promise<boolean> {
          const connection = await this.connection;
          const result = await connection(this.tablename)
               .where('ascensionid', ascensionId)
               .select('isResultLock')
               .first()
               .returning('*');
          return result ? result.isResultLock : false;
     }

     async updateLockStatusOnly(ascensionId: number, isLocked: boolean): Promise<ResultLock | null> {
          const connection = await this.connection;
          const [updatedLock] = await connection(this.tablename)
               .where('ascensionid', ascensionId)
               .update({
                    isResultLock: isLocked
               })
               .returning('*');
          return updatedLock || null;
     }
}

export { ResultLockRepository, ResultLock };
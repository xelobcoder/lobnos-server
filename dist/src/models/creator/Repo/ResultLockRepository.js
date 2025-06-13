"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultLockRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class ResultLockRepository {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
        this.tablename = 'result_lock';
    }
    async create(ascensionId) {
        const connection = await this.connection;
        const result = connection(this.tablename).insert({
            ascensionid: ascensionId,
            isResultLock: false
        })
            .returning('*');
        return result;
    }
    async getByAscensionId(ascensionId) {
        const connection = await this.connection;
        const resultLock = await connection(this.tablename)
            .where('ascensionid', ascensionId)
            .first()
            .returning('*');
        return resultLock || null;
    }
    async updateLockStatus(ascensionId, isLocked) {
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
    async delete(ascensionId) {
        const connection = await this.connection;
        const deleted = await connection(this.tablename)
            .where('ascensionid', ascensionId)
            .delete()
            .returning('*');
        return deleted.length > 0;
    }
    async isLocked(ascensionId) {
        const connection = await this.connection;
        const result = await connection(this.tablename)
            .where('ascensionid', ascensionId)
            .select('isResultLock')
            .first()
            .returning('*');
        return result ? result.isResultLock : false;
    }
    async updateLockStatusOnly(ascensionId, isLocked) {
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
exports.ResultLockRepository = ResultLockRepository;

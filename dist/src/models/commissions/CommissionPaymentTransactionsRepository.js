"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionPaymentTransactionsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class CommissionPaymentTransactionsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
}
exports.CommissionPaymentTransactionsRepository = CommissionPaymentTransactionsRepository;

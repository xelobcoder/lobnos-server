"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTatData = void 0;
const TurnAroundTime_1 = __importDefault(require("../../../models/operations/TurnAroundTime"));
const getTatData = async (req, res) => {
    var _a;
    const page = parseInt(req.query.page) || 1;
    const count = parseInt(req.query.count) || 10;
    const tenantId = parseInt(req.query.tenantId);
    const sorting = ((_a = req.query.sorting) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === 'DESC' ? 'DESC' : 'ASC';
    try {
        const data = await TurnAroundTime_1.default.getPaginatedTATData(tenantId, page, count, sorting);
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.getTatData = getTatData;

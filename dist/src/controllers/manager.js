"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const manager_1 = __importDefault(require("../models/manager/manager"));
const router = express_1.default.Router();
router.get('/api/v1/manager/approvalist', function (request, response) {
    new manager_1.default().getReadyForApprovals(request, response);
});
exports.default = router;

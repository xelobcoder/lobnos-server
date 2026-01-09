"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multi_payment_1 = require("./multi-payment");
const router = (0, express_1.Router)();
router.get('/api/v1/payments/receipt', multi_payment_1.generateTransactionReceiptHandler);
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PharmacyOrderController_1 = require("../../controllers/pharmacy/PharmacyOrderController");
const PharmacyDispensationController_1 = require("../../controllers/pharmacy/PharmacyDispensationController");
const router = (0, express_1.Router)();
// Order routes
router.post('/orders', PharmacyOrderController_1.createOrder);
router.get('/orders/:id', PharmacyOrderController_1.getOrder);
router.put('/orders/:id/pay', PharmacyOrderController_1.markOrderPaid); // Ideally protected to only allow the billing system or accountants to hit it
// Dispensation routes
router.post('/orders/:id/dispense', PharmacyDispensationController_1.dispenseOrder);
exports.default = router;

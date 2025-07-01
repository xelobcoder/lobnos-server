"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PrimeEventsDataSource_1 = require("../../../models/application/sms/events/PrimeEventsDataSource");
const sendSmsPaymentHandler = async (req, res) => {
    const tenantId = Number(req.query.tenantId);
    const billingid = req.query.billingid;
    if (!tenantId || !billingid) {
        return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
    }
    try {
        const parsedBillingId = parseInt(billingid.toString(), 10);
        const repo = new PrimeEventsDataSource_1.PrimeEventsSMSDataSource(tenantId);
        const sms = await repo.paymentConfirmationEvent(tenantId, parsedBillingId);
        console.log('SMS sent:', sms);
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to send SMS payment' });
    }
};

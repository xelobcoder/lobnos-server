"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSentResultReadyMessage = exports.sendResultReadyEvent = exports.getClientResultReadySentcount = exports.sendEventSmsPaymentHandler = void 0;
const PrimeEventsDataSource_1 = require("../../../models/application/sms/events/PrimeEventsDataSource");
const sendEventSmsPaymentHandler = async (req, res) => {
    const tenantId = Number(req.query.tenantId);
    const billingid = req.query.billingid;
    const employeeId = req.query.employeeid;
    if (!billingid || !employeeId)
        return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
    try {
        const parsedBillingId = parseInt(billingid.toString(), 10);
        const parsedEmployeeId = parseInt(employeeId.toString(), 10);
        const repo = new PrimeEventsDataSource_1.PrimeEventsSMSDataSource(tenantId);
        const sms = await repo.paymentConfirmationEvent(tenantId, parsedBillingId, parsedEmployeeId);
        res.send(sms);
    }
    catch (err) {
        console.log('Error sending SMS payment event:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to send SMS payment' });
    }
};
exports.sendEventSmsPaymentHandler = sendEventSmsPaymentHandler;
const getClientResultReadySentcount = async (req, res) => {
    const tenantId = Number(req.query.tenantId);
    const billingid = req.query.billingid;
    if (!tenantId || !billingid)
        return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
    try {
        const parsedBillingId = parseInt(billingid.toString(), 10);
        if (isNaN(parsedBillingId))
            return res.status(400).json({ success: false, error: 'Invalid billingid' });
        const count = await PrimeEventsDataSource_1.PrimeEventsSMSDataSource.getClientResultReadySentcount(tenantId, parsedBillingId);
        res.json({ success: true, count });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to get sent count' });
    }
};
exports.getClientResultReadySentcount = getClientResultReadySentcount;
const sendResultReadyEvent = async (req, res) => {
    const tenantId = Number(req.query.tenantId);
    const billingid = req.query.billingid;
    const employeeId = typeof req.query.employeeid !== 'undefined' ? req.query.employeeid : '';
    const customMessage = typeof req.query.message !== 'undefined' && req.query.message !== null ? req.query.message.toString() : '';
    if (!tenantId || !billingid)
        return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
    try {
        const parsedBillingId = parseInt(billingid.toString(), 10);
        const parsedEmployeeId = employeeId !== '' ? parseInt(employeeId.toString(), 10) : undefined;
        if (isNaN(parsedBillingId))
            return res.status(400).json({ success: false, error: 'Invalid billingid' });
        const repo = new PrimeEventsDataSource_1.PrimeEventsSMSDataSource(tenantId);
        const sms = await repo.testAscensionEventDataAllDone(tenantId, parsedBillingId, parsedEmployeeId, true, customMessage);
        res.json({ success: true, sms });
    }
    catch (err) {
        console.error('Error sending result ready event:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to send result ready event' });
    }
};
exports.sendResultReadyEvent = sendResultReadyEvent;
const getSentResultReadyMessage = async (req, res) => {
    const tenantId = Number(req.query.tenantId);
    const billingid = req.query.billingid;
    if (!tenantId || !billingid)
        return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
    try {
        const parsedBillingId = parseInt(billingid.toString(), 10);
        if (isNaN(parsedBillingId))
            return res.status(400).json({
                success: false,
                error: 'Invalid billingid'
            });
        const message = await PrimeEventsDataSource_1.PrimeEventsSMSDataSource.getSentSMSEventMessage(tenantId, 'PATIENT_RESULT_READY', parsedBillingId);
        if (!message)
            return res.status(404).json({ success: false, error: 'No message found' });
        res.json({ success: true, message });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to get sent message' });
    }
};
exports.getSentResultReadyMessage = getSentResultReadyMessage;

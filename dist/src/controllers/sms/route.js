"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const handlers_1 = require("./handlers");
const SmsEventsHandlers = __importStar(require("./SmsEventsHandlers"));
const router = (0, express_1.Router)();
router.post('/api/v1/sms/sms-templates', handlers_1.SmsTemplateController.handleCreateNewSmsTemplate);
router.get('/api/v1/sms/sms-templates', handlers_1.SmsTemplateController.handleReadSmsTemplateById);
router.get('/api/v1/sms/sms-templates/all', handlers_1.SmsTemplateController.handleReadAllSmsTemplates);
router.put('/api/v1/sms/sms-templates', handlers_1.SmsTemplateController.handleUpdateSmsTemplateById);
router.delete('/api/v1/sms/sms-templates', handlers_1.SmsTemplateController.handleDeleteSmsTemplateById);
router.post('/api/v1/sms/schedule/message', handlers_1.SmsTemplateController.createNewSmsMessage);
router.get("/api/v1/sms/scheduled/messages", handlers_1.SmsTemplateController.getMessages);
router.get("/api/v1/sms/scheduled/messages/unsent", handlers_1.SmsTemplateController.sendScheduledMessageReachedAndUnsentHandler);
router.get("/api/v1/sms/scheduled/messages/recipient", handlers_1.SmsTemplateController.getMessageRecipients);
// SMS Events routes
router.post("/api/v1/sms/events", SmsEventsHandlers.createEvent);
router.get("/api/v1/sms/events", SmsEventsHandlers.getAllEvents);
router.get("/api/v1/sms/events/:id", SmsEventsHandlers.getEventById);
router.put("/api/v1/sms/events/:id", SmsEventsHandlers.updateEvent);
router.delete("/api/v1/sms/events/:id", SmsEventsHandlers.deleteEvent);
const BirthdayHandlers_1 = require("../../controllers/sms/BirthdayHandlers");
router.get('/api/v1/birthday-events/today', BirthdayHandlers_1.BirthdayHandlers.getTodaysBirthdays);
router.get('/api/v1/upcoming-birthdays', BirthdayHandlers_1.BirthdayHandlers.getUpcomingBirthdays);
exports.default = router;

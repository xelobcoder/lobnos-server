import { Router } from 'express';
import { SmsTemplateController } from './handlers';
import * as  SmsEventsHandlers from './SmsEventsHandlers';

const router = Router();

router.post('/api/v1/sms/sms-templates', SmsTemplateController.handleCreateNewSmsTemplate);
router.get('/api/v1/sms/sms-templates', SmsTemplateController.handleReadSmsTemplateById);
router.get('/api/v1/sms/sms-templates/all', SmsTemplateController.handleReadAllSmsTemplates);
router.put('/api/v1/sms/sms-templates', SmsTemplateController.handleUpdateSmsTemplateById);
router.delete('/api/v1/sms/sms-templates', SmsTemplateController.handleDeleteSmsTemplateById);
router.post('/api/v1/sms/schedule/message', SmsTemplateController.createNewSmsMessage);
router.get("/api/v1/sms/scheduled/messages", SmsTemplateController.getMessages);
router.get("/api/v1/sms/scheduled/messages/unsent", SmsTemplateController.sendScheduledMessageReachedAndUnsentHandler);

router.get("/api/v1/sms/scheduled/messages/recipient", SmsTemplateController.getMessageRecipients);
// SMS Events routes
router.post("/api/v1/sms/events", SmsEventsHandlers.createEvent);
router.get("/api/v1/sms/events", SmsEventsHandlers.getAllEvents);
router.get("/api/v1/sms/events/:id", SmsEventsHandlers.getEventById);
router.put("/api/v1/sms/events/:id", SmsEventsHandlers.updateEvent);
router.delete("/api/v1/sms/events/:id", SmsEventsHandlers.deleteEvent);

// SMS Birthday routes
import express from 'express';
import { BirthdayHandlers } from '../../controllers/sms/BirthdayHandlers';


router.get(
    '/api/v1/birthday-events/today',
    BirthdayHandlers.getTodaysBirthdays
);

router.get(
    '/api/v1/upcoming-birthdays',
    BirthdayHandlers.getUpcomingBirthdays
);




export default router;




// Activate or deactivate an event

import { Router } from 'express';
import { handleOverLoad } from '../../hooks/helper';
const router = Router();



import { PrimesmsEventsController } from './PrimesmsEventsController';
import { BirthdayHandlers } from './BirthdayHandlers';

// Load all SMS events
router.get('/api/v1/sms/events', PrimesmsEventsController.getAllEvents);
router.get('/api/v1/sms/events/:id/toggle', handleOverLoad(PrimesmsEventsController.setActiveStatus));
router.put('/api/v1/sms/events/:code/template', handleOverLoad(PrimesmsEventsController.updateTemplate));
router.get('/api/v1/birthday-events/today', BirthdayHandlers.getTodaysBirthdays);
router.get('/api/v1/upcoming-birthdays', BirthdayHandlers.getUpcomingBirthdays);
router.get('/api/v1/birthday-events/week', BirthdayHandlers.getWeekBirthdays);
router.get('/api/v1/birthday-events/month', BirthdayHandlers.getMonthBirthdays);
router.get('/api/v1/birthday-events/all', BirthdayHandlers.getAllBirthdayGroups);




export default router;




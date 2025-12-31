"use strict";
// Activate or deactivate an event
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const helper_1 = require("../../hooks/helper");
const router = (0, express_1.Router)();
const PrimesmsEventsController_1 = require("./PrimesmsEventsController");
const BirthdayHandlers_1 = require("./BirthdayHandlers");
// Load all SMS events
router.get('/api/v1/sms/events', PrimesmsEventsController_1.PrimesmsEventsController.getAllEvents);
router.get('/api/v1/sms/events/:id/toggle', (0, helper_1.handleOverLoad)(PrimesmsEventsController_1.PrimesmsEventsController.setActiveStatus));
router.put('/api/v1/sms/events/:code/template', (0, helper_1.handleOverLoad)(PrimesmsEventsController_1.PrimesmsEventsController.updateTemplate));
router.get('/api/v1/birthday-events/today', BirthdayHandlers_1.BirthdayHandlers.getTodaysBirthdays);
router.get('/api/v1/upcoming-birthdays', BirthdayHandlers_1.BirthdayHandlers.getUpcomingBirthdays);
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const JournalController_1 = require("../JournalController");
const router = (0, express_1.Router)();
const journalController = new JournalController_1.JournalController();
router.get('/journal', (req, res) => journalController.getJournalEntries(req, res));
router.get('/journal/:id', (req, res) => journalController.getJournalEntryById(req, res));
exports.default = router;

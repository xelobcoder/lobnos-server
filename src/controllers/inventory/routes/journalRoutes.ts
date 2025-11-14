import { Router } from 'express';
import { JournalController } from '../JournalController';

const router = Router();
const journalController = new JournalController();

router.get('/journal', (req, res) => journalController.getJournalEntries(req, res));

router.get('/journal/:id', (req, res) => journalController.getJournalEntryById(req, res));

export default router;
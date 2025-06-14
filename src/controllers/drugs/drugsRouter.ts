import express from 'express'
const router = express.Router();

import {
    insertNewDrugCategory,
    getDrugsCategory,
    updateDrugCategory,
    deleteDrugCategory,
    insertNewDrug,
    updateDrug,
    deleteDrug,
    getDrugs
} from "./handlers";
import { handleOverLoad } from '../../hooks/helper';

// Drug Category Routes
router.post('/api/v1/drugsCategory', handleOverLoad(insertNewDrugCategory));
router.get('/api/v1/drugsCategory', getDrugsCategory);
router.put('/api/v1/drugsCategory', handleOverLoad(updateDrugCategory));
router.delete('/api/v1/drugsCategory/:id', handleOverLoad(deleteDrugCategory));

// Drug Routes
router.post('/api/v1/drugs',handleOverLoad( insertNewDrug));
router.get('/api/v1/drugs', getDrugs);
router.put('/api/v1/drugs', handleOverLoad(updateDrug));
router.delete('/api/v1/drugs', handleOverLoad(deleteDrug));

export default router;

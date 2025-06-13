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

// Drug Category Routes
router.post('/api/v1/drugsCategory', insertNewDrugCategory);
router.get('/api/v1/drugsCategory', getDrugsCategory);
router.put('/api/v1/drugsCategory', updateDrugCategory);
router.delete('/api/v1/drugsCategory/:id', deleteDrugCategory);

// Drug Routes
router.post('/api/v1/drugs', insertNewDrug);
router.get('/api/v1/drugs', getDrugs);
router.put('/api/v1/drugs', updateDrug);
router.delete('/api/v1/drugs', deleteDrug);

export default router;

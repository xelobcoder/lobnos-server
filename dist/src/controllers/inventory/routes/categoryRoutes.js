"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const __1 = require("..");
const router = (0, express_1.Router)();
const categoryController = new __1.CategoryController();
// Category routes
router.post('/categories', (req, res) => categoryController.createCategory(req, res));
router.get('/categories/:id', (req, res) => categoryController.getCategoryById(req, res));
router.get('/categories', (req, res) => categoryController.getCategories(req, res));
router.put('/categories/:id', (req, res) => categoryController.updateCategory(req, res));
router.delete('/categories/:id', (req, res) => categoryController.deleteCategory(req, res));
exports.default = router;

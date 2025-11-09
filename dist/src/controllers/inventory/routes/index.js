"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const brandRoutes_1 = __importDefault(require("./brandRoutes"));
const categoryRoutes_1 = __importDefault(require("./categoryRoutes"));
const supplierRoutes_1 = __importDefault(require("./supplierRoutes"));
const storageLocationRoutes_1 = __importDefault(require("./storageLocationRoutes"));
const inventoryItemRoutes_1 = __importDefault(require("./inventoryItemRoutes"));
const purchaseOrderRoutes_1 = __importDefault(require("../../../routes/inventory/purchaseOrderRoutes"));
const router = (0, express_1.Router)();
// Mount all inventory routes
router.use('/', brandRoutes_1.default);
router.use('/', categoryRoutes_1.default);
router.use('/', supplierRoutes_1.default);
router.use('/', storageLocationRoutes_1.default);
router.use('/', inventoryItemRoutes_1.default);
router.use('/', purchaseOrderRoutes_1.default);
exports.default = router;

"use strict";
// Inventory Management System Types and Interfaces
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSACTION_TYPES = exports.PURCHASE_ORDER_ITEM_STATUSES = exports.PURCHASE_ORDER_STATUSES = exports.INVENTORY_STATUSES = exports.INVENTORY_UNITS = void 0;
// Constants and enums
exports.INVENTORY_UNITS = [
    'pieces', 'boxes', 'bottles', 'packs', 'liters', 'kg', 'mg', 'ml',
    'units', 'vials', 'tubes', 'plates', 'strips', 'kits'
];
exports.INVENTORY_STATUSES = [
    'in_stock', 'low_stock', 'out_of_stock', 'expired'
];
exports.PURCHASE_ORDER_STATUSES = [
    'draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'
];
exports.PURCHASE_ORDER_ITEM_STATUSES = [
    'pending', 'partially_received', 'received', 'cancelled'
];
exports.TRANSACTION_TYPES = [
    'consumption', 'addition', 'adjustment', 'transfer'
];

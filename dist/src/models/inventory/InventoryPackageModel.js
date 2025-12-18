"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryPackageModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class InventoryPackageModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    generatePackageId() {
        const timestamp = Date.now().toString();
        return `PKG-${timestamp}`;
    }
    generateTransactionId() {
        const timestamp = Date.now().toString();
        return `PTXN-${timestamp}`;
    }
    async create(request) {
        const connection = await this.connection;
        const packageData = {
            id: this.generatePackageId(),
            item_id: request.item_id,
            package_identifier: request.package_identifier,
            total_quantity: request.total_quantity,
            remaining_quantity: request.total_quantity, // Start with full quantity
            unit: request.unit,
            batch_number: request.batch_number || null,
            expiry_date: request.expiry_date || null,
            opened_date: null,
            is_opened: false,
            storage_location_id: request.storage_location_id || null,
            supplier_id: request.supplier_id || null,
            purchase_order_id: request.purchase_order_id || null,
            cost_per_unit: request.cost_per_unit || null,
            status: 'sealed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await connection('inv_packages').insert(packageData);
        return await this.findById(packageData.id);
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_packages')
            .leftJoin('inv_inventory_items', 'inv_packages.item_id', 'inv_inventory_items.id')
            .leftJoin('inv_storage_locations', 'inv_packages.storage_location_id', 'inv_storage_locations.id')
            .leftJoin('inv_suppliers', 'inv_packages.supplier_id', 'inv_suppliers.id')
            .select('inv_packages.*', 'inv_inventory_items.name as item_name', 'inv_storage_locations.name as location_name', 'inv_suppliers.name as supplier_name')
            .where('inv_packages.id', id)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            item_id: result.item_id,
            package_identifier: result.package_identifier,
            total_quantity: result.total_quantity,
            remaining_quantity: result.remaining_quantity,
            unit: result.unit,
            batch_number: result.batch_number,
            expiry_date: result.expiry_date,
            opened_date: result.opened_date,
            is_opened: result.is_opened,
            storage_location_id: result.storage_location_id,
            supplier_id: result.supplier_id,
            purchase_order_id: result.purchase_order_id,
            cost_per_unit: result.cost_per_unit,
            status: result.status,
            created_at: result.created_at,
            updated_at: result.updated_at
        };
    }
    async openPackage(packageId, openedBy) {
        const connection = await this.connection;
        const trx = await connection.transaction();
        try {
            const packageData = await trx('inv_packages')
                .where('id', packageId)
                .first();
            if (!packageData) {
                throw new Error('Package not found');
            }
            if (packageData.is_opened) {
                throw new Error('Package is already opened');
            }
            // Update package status
            await trx('inv_packages')
                .where('id', packageId)
                .update({
                is_opened: true,
                opened_date: new Date().toISOString().split('T')[0],
                status: 'opened',
                updated_at: new Date().toISOString()
            });
            // Record opening transaction
            await trx('inv_package_transactions').insert({
                id: this.generateTransactionId(),
                package_id: packageId,
                transaction_type: 'open',
                quantity: 0, // Opening doesn't consume quantity
                previous_remaining: packageData.remaining_quantity,
                new_remaining: packageData.remaining_quantity,
                reason: 'Package opened',
                performed_by: openedBy,
                transaction_date: new Date().toISOString()
            });
            await trx.commit();
            return await this.findById(packageId);
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async consumeFromPackage(request) {
        const connection = await this.connection;
        const trx = await connection.transaction();
        try {
            const packageData = await trx('inv_packages')
                .where('id', request.package_id)
                .first();
            if (!packageData) {
                throw new Error('Package not found');
            }
            if (!packageData.is_opened) {
                throw new Error('Package must be opened before consumption');
            }
            if (request.quantity > packageData.remaining_quantity) {
                throw new Error('Cannot consume more than remaining quantity');
            }
            const newRemaining = packageData.remaining_quantity - request.quantity;
            const newStatus = newRemaining === 0 ? 'empty' : 'opened';
            // Update package
            await trx('inv_packages')
                .where('id', request.package_id)
                .update({
                remaining_quantity: newRemaining,
                status: newStatus,
                updated_at: new Date().toISOString()
            });
            // Record consumption transaction
            await trx('inv_package_transactions').insert({
                id: this.generateTransactionId(),
                package_id: request.package_id,
                transaction_type: 'consume',
                quantity: request.quantity,
                previous_remaining: packageData.remaining_quantity,
                new_remaining: newRemaining,
                reason: request.reason || 'Consumption',
                performed_by: request.performed_by,
                transaction_date: new Date().toISOString()
            });
            // Update main inventory stock
            await trx('inv_inventory_items')
                .where('id', packageData.item_id)
                .decrement('current_stock', request.quantity);
            await trx.commit();
            return await this.findById(request.package_id);
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async getPackageConsumptionHistory(packageId) {
        const connection = await this.connection;
        const results = await connection('inv_package_transactions')
            .where('package_id', packageId)
            .orderBy('transaction_date', 'DESC');
        return results.map((result) => ({
            id: result.id,
            package_id: result.package_id,
            transaction_type: result.transaction_type,
            quantity: result.quantity,
            previous_remaining: result.previous_remaining,
            new_remaining: result.new_remaining,
            reason: result.reason,
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
    }
    async findByItemId(itemId) {
        const connection = await this.connection;
        const results = await connection('inv_packages')
            .where('item_id', itemId)
            .orderBy('created_at', 'DESC');
        return results.map((result) => ({
            id: result.id,
            item_id: result.item_id,
            package_identifier: result.package_identifier,
            total_quantity: result.total_quantity,
            remaining_quantity: result.remaining_quantity,
            unit: result.unit,
            batch_number: result.batch_number,
            expiry_date: result.expiry_date,
            opened_date: result.opened_date,
            is_opened: result.is_opened,
            storage_location_id: result.storage_location_id,
            supplier_id: result.supplier_id,
            purchase_order_id: result.purchase_order_id,
            cost_per_unit: result.cost_per_unit,
            status: result.status,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
    }
}
exports.InventoryPackageModel = InventoryPackageModel;

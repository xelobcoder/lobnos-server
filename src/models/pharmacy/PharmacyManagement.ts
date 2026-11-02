import { createHash, randomUUID } from "crypto";
import Decimal from "decimal.js";
import { assertPharmacyDayOpen, postPharmacyJournal, resolvePharmacyDestination } from "./PharmacyLedger";
import { money, quantity, validatePharmacyReceipt, pharmacyReceivingUnits } from "./PharmacyRules";
import { resolveStockStatus } from "./entities/PharmacyStock";
import { assertNoStockCount } from "./PharmacyEnterpriseCore";
import { roleAllowed } from "../../middleware/roles";

const text = (value: unknown, label: string, max = 255): string => {
     if (typeof value !== "string" || !value.trim() || value.trim().length > max)
          throw new Error(`Enter a valid ${label}`);
     return value.trim();
};
export function validAmount(value: unknown, label: string, allowZero = false): number {
     if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < (allowZero ? 0 : 0.01) ||
          money(value) !== value ||
          value > 999999999999.99
     )
          throw new Error(`Enter a valid ${label} with at most two decimal places`);
     return value;
}
export class PharmacyManagement {
     constructor(
          private readonly db: any,
          private readonly branch: number,
          private readonly actor: number,
          private readonly actorRole: string = "",
     ) {
          if (!Number.isInteger(branch) || branch <= 0) throw new Error("Select an operating branch");
          if (!Number.isInteger(actor) || actor <= 0) throw new Error("An authenticated employee is required");
     }

     async setup() {
          const today = new Date().toISOString().slice(0, 10);
          const [accounts, routes, shift, day, days, previousDay, previousShift] = await Promise.all([
               this.db("pharmacy_collection_accounts")
                    .where({ branchid: this.branch, is_active: true })
                    .orderBy("name"),
               this.db("pharmacy_payment_routes").where({ branchid: this.branch }),
               this.db("pharmacy_shifts")
                    .where({ active_key: `${this.branch}:${this.actor}` })
                    .first(),
               this.db("pharmacy_financial_days").where({ branchid: this.branch, financial_date: today }).first(),
               this.db("pharmacy_financial_days")
                    .where({ branchid: this.branch })
                    .orderBy("status", "desc")
                    .orderBy("financial_date", "desc")
                    .limit(31),
               this.db("pharmacy_financial_days")
                    .where({ branchid: this.branch, status: "open" })
                    .whereNotNull("opened_at")
                    .where("financial_date", "<", today)
                    .orderBy("financial_date", "asc")
                    .first(),
               this.db("pharmacy_shifts")
                    .where({ branchid: this.branch })
                    .whereNotNull("active_key")
                    .whereRaw("COALESCE(financial_date, DATE(opened_at)) < ?", [today])
                    .orderBy("opened_at", "asc")
                    .first(),
          ]);
          return {
               accounts,
               routes,
               shift: shift || null,
               day: day || null,
               days,
               previousDay: previousDay || null,
               previousShift: previousShift
                    ? { financial_date: previousShift.financial_date || previousShift.opened_at }
                    : null,
               financialDate: today,
               shiftSummary: shift ? await this.shiftTotals(this.db, shift) : null,
          };
     }

     async saveDestination(input: any) {
          const name = text(input.name, "destination name", 120);
          if (!["cash", "bank", "mobile_money"].includes(input.accountType))
               throw new Error("Invalid destination type");
          return this.db.transaction(async (trx: any) => {
               const [id] = await trx("pharmacy_collection_accounts").insert({
                    branchid: this.branch,
                    name,
                    account_type: input.accountType,
                    currency: "GHS",
                    is_active: true,
                    created_by: this.actor,
               });
               return { id };
          });
     }
     async saveRoute(input: any) {
          if (!["cash", "card", "mobile_money"].includes(input.method) || !Number.isInteger(input.accountId))
               throw new Error("Select a payment method and destination");
          return this.db.transaction(async (trx: any) => {
               const account = await trx("pharmacy_collection_accounts")
                    .where({
                         id: input.accountId,
                         branchid: this.branch,
                         is_active: true,
                         account_type: input.method === "card" ? "bank" : input.method,
                    })
                    .forUpdate()
                    .first();
               if (!account) throw new Error("Select a matching pharmacy destination in this branch");
               await trx("pharmacy_payment_routes")
                    .insert({
                         branchid: this.branch,
                         method: input.method,
                         account_id: input.accountId,
                         updated_by: this.actor,
                         updated_at: new Date(),
                    })
                    .onConflict(["branchid", "method"])
                    .merge(["account_id", "updated_by", "updated_at"]);
               return { configured: true };
          });
     }
     async createItem(input: any) {
          const name = text(input.name, "medicine name");
          const sku = text(input.sku, "SKU", 100);
          const price = validAmount(input.salePrice, "retail price", true),
               wholesale = validAmount(input.wholesalePrice ?? 0, "wholesale price", true);
          const min = input.minimumStock ?? 0;
          if (!Number.isFinite(min) || min < 0 || quantity(min) !== min) throw new Error("Invalid reorder quantity");
          if (typeof input.batchTracking !== "boolean" || typeof input.requiresPrescription !== "boolean")
               throw new Error("Choose prescription and batch tracking settings");
          const id = randomUUID();
          const purchaseUnit = input.purchaseUnit ? text(input.purchaseUnit, "purchase pack", 100) : null;
          const factor = purchaseUnit ? input.unitsPerPurchaseUnit : 1;
          if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0 || quantity(factor) !== factor)
               throw new Error("Enter a positive number of base units per purchase pack");
          await this.db("pharmacy_inventory_items").insert({
               id,
               branchid: this.branch,
               name,
               sku,
               consumption_unit: text(input.unit || "unit", "unit", 100),
               purchase_unit: purchaseUnit,
               units_per_purchase_unit: factor,
               sale_price: price,
               wholesale_price: wholesale,
               min_stock: min,
               pharmacy_batch_tracking: input.batchTracking,
               requires_prescription: input.requiresPrescription,
          });
          return { id };
     }
     async suppliers() {
          return this.db("pharmacy_suppliers").where({ branchid: this.branch, is_active: true }).orderBy("name");
     }
     async updateItem(id: string, input: any) {
          const price = validAmount(input.salePrice, "sale price", true),
               minimum = input.minimumStock;
          if (typeof minimum !== "number" || !Number.isFinite(minimum) || minimum < 0 || quantity(minimum) !== minimum)
               throw new Error("Invalid reorder quantity");
          return this.db.transaction(async (trx: any) => {
               const item = await trx("pharmacy_inventory_items")
                    .where({ id, branchid: this.branch })
                    .forUpdate()
                    .first();
               if (!item) throw new Error("Pharmacy item not found in this branch");
               await assertNoStockCount(trx, id);
               const factor = input.purchaseUnit ? input.unitsPerPurchaseUnit : 1;
               if (
                    input.purchaseUnit !== undefined &&
                    (typeof factor !== "number" ||
                         !Number.isFinite(factor) ||
                         factor <= 0 ||
                         quantity(factor) !== factor)
               )
                    throw new Error("Enter a valid purchase pack size");
               for (const flag of ["requiresPrescription", "batchTracking"])
                    if (input[flag] !== undefined && typeof input[flag] !== "boolean")
                         throw new Error("Medicine settings must be true or false");
               const values = {
                    ...(input.requiresPrescription !== undefined
                         ? { requires_prescription: input.requiresPrescription }
                         : {}),
                    ...(input.batchTracking !== undefined ? { pharmacy_batch_tracking: input.batchTracking } : {}),
                    sale_price: price,
                    ...(input.wholesalePrice !== undefined
                         ? { wholesale_price: validAmount(input.wholesalePrice, "wholesale price", true) }
                         : {}),
                    min_stock: minimum,
                    ...(input.purchaseUnit !== undefined
                         ? {
                                purchase_unit: input.purchaseUnit
                                     ? text(input.purchaseUnit, "purchase pack", 100)
                                     : null,
                                units_per_purchase_unit: factor,
                           }
                         : {}),
               };
               await trx("pharmacy_inventory_items")
                    .where({ id })
                    .update({
                         ...values,
                         status: resolveStockStatus(Number(item.current_stock), minimum),
                         updated_at: new Date(),
                    });
               await trx("pharmacy_item_profile_audit").insert({
                    item_id: id,
                    previous_values: JSON.stringify({
                         sale_price: item.sale_price,
                         wholesale_price: item.wholesale_price,
                         min_stock: item.min_stock,
                         requires_prescription: item.requires_prescription,
                         pharmacy_batch_tracking: item.pharmacy_batch_tracking,
                    }),
                    new_values: JSON.stringify(values),
                    changed_by: this.actor,
                    changed_at: new Date(),
               });
               return { updated: true };
          });
     }
     async batches(id: string) {
          if (!(await this.db("pharmacy_inventory_items").where({ id, branchid: this.branch }).first()))
               throw new Error("Pharmacy item not found in this branch");
          return this.db("pharmacy_stock_movements")
               .where({ item_id: id })
               .select("batch_number")
               .min("expiry_date as expiry_date")
               .select(this.db.raw("SUM(new_stock - previous_stock) AS available"))
               .groupBy("batch_number");
     }
     async writeOff(id: string, input: any) {
          const count = input.quantity,
               reason = text(input.reason, "write-off reason", 500);
          if (typeof count !== "number" || !Number.isFinite(count) || count <= 0 || quantity(count) !== count)
               throw new Error("Enter a positive quantity with at most three decimal places");
          return this.document("write_off", { ...input, itemId: id }, async (trx, reference) => {
               const item = await trx("pharmacy_inventory_items")
                    .where({ id, branchid: this.branch })
                    .forUpdate()
                    .first();
               await assertNoStockCount(trx, id);
               if (!item || count > Number(item.current_stock))
                    throw new Error("Insufficient pharmacy stock in this branch");
               if (item.pharmacy_batch_tracking && !input.batchNumber)
                    throw new Error("Select the manufacturer batch for this write-off");
               const query = trx("pharmacy_stock_movements").where({ item_id: id });
               if (input.batchNumber) query.where("batch_number", input.batchNumber);
               else query.whereNull("batch_number");
               const batch = await query
                    .select(trx.raw("COALESCE(SUM(new_stock - previous_stock),0) AS available"))
                    .min("expiry_date as expiry_date")
                    .first();
               if (count > Number(batch?.available || 0))
                    throw new Error("Insufficient quantity in this batch; reconcile its opening stock history first");
               const next = quantity(Number(item.current_stock) - count),
                    cost = money(new Decimal(count).mul(item.cost_price));
               await trx("pharmacy_inventory_items")
                    .where({ id })
                    .update({
                         current_stock: next,
                         status: resolveStockStatus(next, Number(item.min_stock)),
                         last_updated: new Date(),
                         updated_at: new Date(),
                    });
               await trx("pharmacy_stock_movements").insert({
                    id: reference,
                    item_id: id,
                    branchid: this.branch,
                    transaction_type: "write_off",
                    quantity: count,
                    previous_stock: item.current_stock,
                    new_stock: next,
                    unit_cost: item.cost_price,
                    total_cost: cost,
                    reason,
                    reference_id: reference,
                    performed_by: this.actor,
                    transaction_date: new Date(),
                    batch_number: input.batchNumber || null,
                    expiry_date: batch.expiry_date || null,
               });
               if (cost)
                    await postPharmacyJournal(trx, this.branch, reference, "write_off", reason, this.actor, [
                         { account: "operating_expenses", debit: cost },
                         { account: "inventory", credit: cost },
                    ]);
               return {
                    amount: cost,
                    details: { itemId: id, quantity: count, batchNumber: input.batchNumber, reason },
               };
          });
     }
     async createSupplier(input: any) {
          const id = randomUUID();
          const name = text(input.name, "supplier name");
          await this.db("pharmacy_suppliers").insert({
               id,
               branchid: this.branch,
               name,
               phone: input.phone ? text(input.phone, "phone", 100) : null,
               email: input.email ? text(input.email, "email") : null,
          });
          return { id };
     }

     /** All money/stock documents carry a stable request fingerprint; retries cannot replay writes. */
     private async document(
          kind: string,
          input: any,
          work: (trx: any, id: string) => Promise<{ amount: number; supplierId?: string; details: any }>,
     ) {
          const key = text(input.idempotencyKey, "request key", 128);
          if (!/^[A-Za-z0-9:_-]{8,128}$/.test(key)) throw new Error("Invalid request key");
          const hash = createHash("sha256")
               .update(JSON.stringify({ branch: this.branch, actor: this.actor, kind, input }))
               .digest("hex");
          return this.db.transaction(async (trx: any) => {
               let previous = await trx("pharmacy_documents").where({ request_key: key }).first();
               if (!previous) {
                    if (kind !== "purchase_order")
                         await assertPharmacyDayOpen(
                              trx,
                              this.branch,
                              kind === "manual_journal" && input.financialDate ? input.financialDate : new Date(),
                         );
                    previous = await trx("pharmacy_documents").where({ request_key: key }).forUpdate().first();
               }
               if (previous) {
                    if (previous.request_hash !== hash || Number(previous.branchid) !== this.branch)
                         throw new Error("Request key belongs to a different operation");
                    return { id: previous.id, amount: Number(previous.amount), details: JSON.parse(previous.details) };
               }
               const id = randomUUID();
               const result = await work(trx, id);
               await trx("pharmacy_documents").insert({
                    id,
                    branchid: this.branch,
                    kind,
                    request_key: key,
                    request_hash: hash,
                    supplier_id: result.supplierId || null,
                    amount: result.amount,
                    details: JSON.stringify(result.details),
                    created_by: this.actor,
               });
               return { id, amount: result.amount, details: result.details };
          });
     }
     async receive(itemId: string, input: any) {
          const count = input.quantity;
          if (typeof count !== "number" || !Number.isFinite(count) || count <= 0 || quantity(count) !== count)
               throw new Error("Enter a positive quantity with at most three decimal places");
          const cost = validAmount(input.unit_price, "unit cost", true);
          return this.document("receipt", { ...input, itemId }, async (trx, id) => {
               if (input.orderLineId && input.unit_type === "purchase")
                    throw new Error("Receive purchase-order quantities in the base units specified on the order");
               let orderLine: any;
               if (input.orderLineId) {
                    const snapshot = await trx("pharmacy_purchase_order_lines")
                         .where({ id: input.orderLineId })
                         .first();
                    const order =
                         snapshot &&
                         (await trx("pharmacy_purchase_orders")
                              .where({ id: snapshot.order_id, branchid: this.branch })
                              .forUpdate()
                              .first());
                    orderLine =
                         order &&
                         (await trx("pharmacy_purchase_order_lines")
                              .where({ id: input.orderLineId, item_id: itemId })
                              .forUpdate()
                              .first());
                    if (
                         !order ||
                         !orderLine ||
                         order.status === "cancelled" ||
                         order.supplier_id !== input.supplier_id ||
                         Number(orderLine.unit_cost) !== cost ||
                         quantity(Number(orderLine.quantity_received) + count) > Number(orderLine.quantity_ordered)
                    )
                         throw new Error("Receipt does not match an outstanding pharmacy order line");
               }
               const item = await trx("pharmacy_inventory_items")
                    .where({ id: itemId, branchid: this.branch, is_active: true })
                    .forUpdate()
                    .first();
               if (!item) throw new Error("Pharmacy item not found in this branch");
               await assertNoStockCount(trx, itemId);
               const conversion = pharmacyReceivingUnits(item, input);
               const baseCount = conversion.baseQuantity,
                    baseCost = conversion.baseUnitCost;
               if (input.batch_number != null && typeof input.batch_number !== "string")
                    throw new Error("Enter a valid batch number");
               const generatedBatch = !input.batch_number?.trim();
               const batchNumber = generatedBatch ? "AUTO-" + id.toUpperCase() : input.batch_number.trim();
               validatePharmacyReceipt(
                    { ...item, inventory_domain: "pharmacy" },
                    { ...input, batch_number: batchNumber },
               );
               if (
                    input.batch_number &&
                    (typeof input.batch_number !== "string" || input.batch_number.trim().length > 100)
               )
                    throw new Error("Enter a valid manufacturer batch number");
               if (
                    input.expiry_date &&
                    (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiry_date) ||
                         !Number.isFinite(Date.parse(input.expiry_date)) ||
                         new Date(input.expiry_date).toISOString().slice(0, 10) !== input.expiry_date ||
                         input.expiry_date < new Date().toISOString().slice(0, 10))
               )
                    throw new Error("Enter a valid unexpired expiry date");
               if (
                    input.supplier_id &&
                    !(await trx("pharmacy_suppliers")
                         .where({ id: input.supplier_id, branchid: this.branch, is_active: true })
                         .first())
               )
                    throw new Error("Pharmacy supplier not found");
               const total = conversion.total;
               if (total > 0 && !input.supplier_id) throw new Error("Choose a pharmacy supplier for purchased stock");
               if (batchNumber) {
                    const prior = await trx("pharmacy_stock_movements")
                         .where({ item_id: itemId, batch_number: batchNumber })
                         .first();
                    if (
                         prior &&
                         String(prior.expiry_date ? new Date(prior.expiry_date).toISOString().slice(0, 10) : "") !==
                              String(input.expiry_date || "")
                    )
                         throw new Error("This batch already has a different expiry date");
               }
               const previous = Number(item.current_stock),
                    next = quantity(previous + baseCount);
               if (next > 99999999999.999) throw new Error("Stock quantity exceeds the supported limit");
               const average = new Decimal(previous)
                    .mul(item.cost_price)
                    .plus(total)
                    .div(next)
                    .toDecimalPlaces(6)
                    .toNumber();
               const prices = input.change_pricing
                    ? {
                           sale_price: validAmount(input.new_sale_price, "sale price", true),
                           wholesale_price: validAmount(input.new_wholesale_price, "wholesale price", true),
                      }
                    : {};
               await trx("pharmacy_inventory_items")
                    .where({ id: itemId })
                    .update({
                         current_stock: next,
                         cost_price: average,
                         status: resolveStockStatus(next, Number(item.min_stock)),
                         last_updated: new Date(),
                         updated_at: new Date(),
                         ...prices,
                    });
               await trx("pharmacy_stock_movements").insert({
                    id,
                    item_id: itemId,
                    branchid: this.branch,
                    transaction_type: "addition",
                    quantity: baseCount,
                    previous_stock: previous,
                    new_stock: next,
                    unit_cost: baseCost,
                    total_cost: total,
                    purchase_quantity: count,
                    receiving_unit: conversion.receivingUnit,
                    conversion_factor: conversion.factor,
                    purchase_unit_cost: cost,
                    reason: "Pharmacy stock receipt",
                    reference_id: id,
                    performed_by: this.actor,
                    transaction_date: new Date(),
                    batch_number: batchNumber || null,
                    expiry_date: input.expiry_date || null,
               });
               if (total)
                    await postPharmacyJournal(
                         trx,
                         this.branch,
                         id,
                         "receipt",
                         `Stock receipt: ${item.name}`,
                         this.actor,
                         [
                              { account: "inventory", debit: total },
                              { account: `payable:${input.supplier_id}`, credit: total },
                         ],
                    );
               if (orderLine) {
                    await trx("pharmacy_purchase_order_lines")
                         .where({ id: orderLine.id })
                         .update({ quantity_received: quantity(Number(orderLine.quantity_received) + count) });
                    const lines = await trx("pharmacy_purchase_order_lines").where({ order_id: orderLine.order_id });
                    await trx("pharmacy_purchase_orders")
                         .where({ id: orderLine.order_id })
                         .update({
                              status: lines.every(
                                   (l: any) => Number(l.quantity_received) === Number(l.quantity_ordered),
                              )
                                   ? "received"
                                   : "partially_received",
                         });
               }
               return {
                    amount: total,
                    supplierId: input.supplier_id,
                    details: {
                         itemId,
                         quantity: baseCount,
                         receivedQuantity: count,
                         receivingUnit: conversion.receivingUnit,
                         conversionFactor: conversion.factor,
                         unitCost: baseCost,
                         purchaseUnitCost: cost,
                         batch: batchNumber,
                         batchGenerated: generatedBatch,
                         expiry: input.expiry_date,
                         orderLineId: input.orderLineId,
                    },
               };
          });
     }

     async orders() {
          const orders = await this.db("pharmacy_purchase_orders")
               .where({ branchid: this.branch })
               .orderBy("created_at", "desc")
               .limit(100);
          const lines = await this.db("pharmacy_purchase_order_lines as l")
               .join("pharmacy_inventory_items as i", "i.id", "l.item_id")
               .whereIn(
                    "l.order_id",
                    orders.map((o: any) => o.id),
               )
               .select("l.*", "i.name", "i.sku");
          return orders.map((order: any) => ({ ...order, lines: lines.filter((l: any) => l.order_id === order.id) }));
     }
     async receipts(input: any = {}) {
          const page = Math.max(1, Number(input.page) || 1),
               count = Math.min(100, Math.max(1, Number(input.count) || 25));
          const base = this.db("pharmacy_documents").where({ branchid: this.branch, kind: "receipt" });
          const [rows, total] = await Promise.all([
               base
                    .clone()
                    .orderBy("created_at", "desc")
                    .limit(count)
                    .offset((page - 1) * count),
               base.clone().count("* as count").first(),
          ]);
          const details = rows.map((row: any) => ({
               ...row,
               details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
          }));
          const ids = [...new Set(details.map((row: any) => row.details.itemId))];
          const items = ids.length
               ? await this.db("pharmacy_inventory_items")
                      .where({ branchid: this.branch })
                      .whereIn("id", ids)
                      .select("id", "name", "consumption_unit")
               : [];
          return {
               page,
               count,
               total: Number(total?.count || 0),
               items: details.map((row: any) => {
                    const item = items.find((i: any) => i.id === row.details.itemId);
                    return {
                         ...row,
                         itemName: item?.name || "Archived medicine",
                         unit: item?.consumption_unit || "units",
                    };
               }),
          };
     }
     async createOrder(input: any) {
          if (
               !Array.isArray(input.lines) ||
               !input.lines.length ||
               input.lines.length > 100 ||
               new Set(input.lines.map((l: any) => l.itemId)).size !== input.lines.length
          )
               throw new Error("Choose 1 to 100 different medicines");
          for (const line of input.lines) {
               if (
                    typeof line.quantity !== "number" ||
                    !Number.isFinite(line.quantity) ||
                    line.quantity <= 0 ||
                    quantity(line.quantity) !== line.quantity
               )
                    throw new Error("Invalid ordered quantity");
               validAmount(line.unitCost, "unit cost", true);
          }
          return this.document("purchase_order", input, async (trx, id) => {
               if (
                    !(await trx("pharmacy_suppliers")
                         .where({ id: input.supplierId, branchid: this.branch, is_active: true })
                         .first())
               )
                    throw new Error("Pharmacy supplier not found");
               const items = await trx("pharmacy_inventory_items")
                    .where({ branchid: this.branch, is_active: true })
                    .whereIn(
                         "id",
                         input.lines.map((l: any) => l.itemId),
                    );
               if (items.length !== input.lines.length)
                    throw new Error("Pharmacy order contains unavailable items or items outside this branch");
               const total = money(
                    input.lines.reduce(
                         (sum: Decimal, l: any) => sum.plus(money(new Decimal(l.quantity).mul(l.unitCost))),
                         new Decimal(0),
                    ),
               );
               await trx("pharmacy_purchase_orders").insert({
                    id,
                    branchid: this.branch,
                    supplier_id: input.supplierId,
                    status: "ordered",
                    total_amount: total,
                    created_by: this.actor,
                    notes: input.notes ? text(input.notes, "order notes", 500) : null,
               });
               await trx("pharmacy_purchase_order_lines").insert(
                    input.lines.map((l: any) => ({
                         id: randomUUID(),
                         order_id: id,
                         item_id: l.itemId,
                         quantity_ordered: l.quantity,
                         quantity_received: 0,
                         unit_cost: l.unitCost,
                    })),
               );
               return { amount: total, supplierId: input.supplierId, details: { lines: input.lines } };
          });
     }
     async cancelOrder(id: string) {
          return this.db.transaction(async (trx: any) => {
               const order = await trx("pharmacy_purchase_orders")
                    .where({ id, branchid: this.branch })
                    .forUpdate()
                    .first();
               if (!order) throw new Error("Pharmacy order not found");
               if (order.status === "cancelled") return { cancelled: true };
               if (order.status !== "ordered") throw new Error("Only an unreceived order can be cancelled");
               await trx("pharmacy_purchase_orders").where({ id }).update({ status: "cancelled" });
               await trx("pharmacy_documents").insert({
                    id: randomUUID(),
                    branchid: this.branch,
                    kind: "order_cancel",
                    request_key: `cancel:${id}`,
                    request_hash: createHash("sha256").update(id).digest("hex"),
                    amount: 0,
                    details: JSON.stringify({ orderId: id }),
                    created_by: this.actor,
               });
               return { cancelled: true };
          });
     }

     async disburse(kind: "expense" | "supplier_payment", input: any) {
          const amount = validAmount(input.amount, "amount");
          const description = text(input.description, "description", 500);
          if (!["cash", "card", "mobile_money"].includes(input.method)) throw new Error("Invalid payment method");
          if (input.method !== "cash" && !input.reference?.trim()) throw new Error("Enter the payment reference");
          return this.document(kind, input, async (trx, id) => {
               const accounting = await trx("pharmacy_accounting_settings").where({ branchid: this.branch }).forUpdate().first();
               if (Number(accounting?.enabled)) throw new Error(kind === "expense" ? "Create and approve this expense in Pharmacy Accounting before recording payment" : "Create and approve a bill-allocated supplier settlement in Pharmacy Accounting before recording payment");
               const account = await resolvePharmacyDestination(trx, this.branch, input.method);
               let debit = "operating_expenses";
               if (kind === "supplier_payment") {
                    if (
                         !(await trx("pharmacy_suppliers")
                              .where({ id: input.supplierId, branchid: this.branch, is_active: true })
                              .first())
                    )
                         throw new Error("Pharmacy supplier not found");
                    debit = `payable:${input.supplierId}`;
                    const balance = await this.accountBalance(trx, debit);
                    if (amount > money(-balance))
                         throw new Error("Payment exceeds the outstanding pharmacy supplier balance");
               }
               const shift =
                    input.method === "cash"
                         ? await trx("pharmacy_shifts")
                                .where({ active_key: `${this.branch}:${this.actor}` })
                                .forUpdate()
                                .first()
                         : null;
               if (input.method === "cash" && !shift)
                    throw new Error("Open a pharmacy shift before making a cash payment");
               if (shift && this.shiftDate(shift) !== new Date().toISOString().slice(0, 10))
                    throw new Error(
                         "Close the previous day’s cashier shift and open a current shift before making a cash payment",
                    );
               await postPharmacyJournal(trx, this.branch, id, kind, description, this.actor, [
                    { account: debit, debit: amount },
                    { account: `collection:${account.id}`, credit: amount },
               ]);
               return {
                    amount,
                    supplierId: input.supplierId,
                    details: {
                         description,
                         method: input.method,
                         reference: input.reference,
                         accountId: account.id,
                         shiftId: shift?.id,
                    },
               };
          });
     }
     private async accountBalance(trx: any, account: string): Promise<number> {
          const result = await trx("pharmacy_journal_lines as l")
               .join("pharmacy_journals as j", "j.id", "l.journal_id")
               .where({ "j.branchid": this.branch, "l.account_code": account })
               .sum("l.debit as debit")
               .sum("l.credit as credit")
               .first();
          return money(new Decimal(result?.debit || 0).minus(result?.credit || 0));
     }
     async reports() {
          const [balances, documents, recentDays, recentShifts, pendingDays, pendingShifts] = await Promise.all([
               this.db("pharmacy_journal_lines as l")
                    .join("pharmacy_journals as j", "j.id", "l.journal_id")
                    .where("j.branchid", this.branch)
                    .select("l.account_code")
                    .sum("l.debit as debit")
                    .sum("l.credit as credit")
                    .groupBy("l.account_code"),
               this.db("pharmacy_documents").where({ branchid: this.branch }).orderBy("created_at", "desc").limit(100),
               this.db("pharmacy_financial_days")
                    .where({ branchid: this.branch })
                    .orderBy("status", "desc")
                    .orderBy("financial_date", "desc")
                    .limit(31),
               this.db("pharmacy_shifts").where({ branchid: this.branch }).orderBy("opened_at", "desc").limit(50),
               this.db("pharmacy_financial_days")
                    .where({ branchid: this.branch, status: "open" })
                    .orderBy("financial_date", "asc"),
               this.db("pharmacy_shifts")
                    .where({ branchid: this.branch })
                    .whereNull("reviewed_by")
                    .orderBy("opened_at", "asc"),
          ]);
          // Unresolved historical handovers must remain reachable beyond recent-history limits.
          const days = [...new Map([...pendingDays, ...recentDays].map((row: any) => [row.id, row])).values()];
          const shifts = [...new Map([...pendingShifts, ...recentShifts].map((row: any) => [row.id, row])).values()];
          const value = (code: string) => {
               const row = balances.find((r: any) => r.account_code === code);
               return money(new Decimal(row?.debit || 0).minus(row?.credit || 0));
          };
          return {
               events: await this.db("pharmacy_financial_day_events")
                    .where({ branchid: this.branch })
                    .orderBy("created_at", "desc")
                    .limit(100),
               balances,
               revenue: -value("sales"),
               costOfSales: value("cost_of_sales"),
               expenses: value("operating_expenses"),
               profit: money(-value("sales") - value("cost_of_sales") - value("operating_expenses")),
               documents,
               days,
               shifts,
          };
     }
     async openDay(input: any) {
          const today = new Date().toISOString().slice(0, 10);
          if (input.date !== today)
               throw new Error("Open the pharmacy financial day for today. Historical closed days cannot be reopened.");
          const note = input.note ? text(input.note, "opening note", 500) : null;
          return this.db.transaction(async (trx: any) => {
               const previous = await trx("pharmacy_financial_days")
                    .where({ branchid: this.branch, status: "open" })
                    .whereNotNull("opened_at")
                    .where("financial_date", "<", today)
                    .forUpdate()
                    .first();
               if (previous) throw new Error("Close the previous pharmacy financial day before opening today.");
               const oldShift = await trx("pharmacy_shifts")
                    .where({ branchid: this.branch })
                    .whereNotNull("active_key")
                    .whereRaw("COALESCE(financial_date, DATE(opened_at)) < ?", [today])
                    .first();
               if (oldShift) throw new Error("Close the previous day’s cashier shifts before opening today.");
               await trx("pharmacy_financial_days")
                    .insert({
                         branchid: this.branch,
                         financial_date: today,
                         status: "open",
                         opened_by: this.actor,
                         opened_at: new Date(),
                         opening_note: note,
                    })
                    .onConflict(["branchid", "financial_date"])
                    .ignore();
               const day = await trx("pharmacy_financial_days")
                    .where({ branchid: this.branch, financial_date: today })
                    .forUpdate()
                    .first();
               if (day.status !== "open")
                    throw new Error(
                         "This pharmacy financial day is already closed. Start the next financial day on its date.",
                    );
               if (!day.opened_at)
                    await trx("pharmacy_financial_days")
                         .where({ id: day.id })
                         .update({ opened_by: this.actor, opened_at: new Date(), opening_note: note });
               return { date: today, status: "open" };
          });
     }

     private shiftDate(shift: any): string {
          const date = shift.financial_date || shift.opened_at;
          return date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
     }

     private async shiftTotals(trx: any, shift: any) {
          const [sales, refunds, payments, compositeSales, compositeRefunds] = await Promise.all([
               trx("pharmacy_payments as p")
                    .join("pharmacy_sales as s", "s.id", "p.sale_id")
                    .where({ "s.shift_id": shift.id, "p.method": "cash" })
                    .sum("p.amount as amount")
                    .first(),
               trx("pharmacy_payments")
                    .where({ refund_shift_id: shift.id, method: "cash", status: "refunded" })
                    .sum("amount as amount")
                    .first(),
               trx("pharmacy_documents")
                    .where({ branchid: this.branch })
                    .whereIn("kind", ["expense", "supplier_payment"]),
               trx("pharmacy_cash_events")
                    .where({ branchid: this.branch, shift_id: shift.id, method: "cash", event_type: "collection" })
                    .sum("amount as amount")
                    .first(),
               trx("pharmacy_cash_events")
                    .where({ branchid: this.branch, shift_id: shift.id, method: "cash", event_type: "refund" })
                    .sum("amount as amount")
                    .first(),
          ]);
          const cashOut = payments.reduce(
               (sum: number, row: any) =>
                    JSON.parse(row.details).shiftId === shift.id ? sum + Number(row.amount) : sum,
               0,
          );
          const cashSales = money(Number(sales?.amount || 0) + Number(compositeSales?.amount || 0)),
               cashRefunds = money(Number(refunds?.amount || 0) + Number(compositeRefunds?.amount || 0));
          const expectedCash = money(
               new Decimal(shift.opening_float).plus(cashSales).minus(cashRefunds).minus(cashOut),
          );
          return {
               openingFloat: Number(shift.opening_float),
               cashSales,
               cashRefunds,
               cashOut: money(cashOut),
               expectedCash,
          };
     }

     async openShift(input: any) {
          const float = validAmount(input.openingFloat, "opening float", true);
          return this.db.transaction(async (trx: any) => {
               const date = await assertPharmacyDayOpen(trx, this.branch);
               const existing = await trx("pharmacy_shifts")
                    .where({ active_key: this.branch + ":" + this.actor })
                    .forUpdate()
                    .first();
               if (existing)
                    throw new Error("You already have an open pharmacy shift. Close it before opening another.");
               if (float > 0) await resolvePharmacyDestination(trx, this.branch, "cash");
               else {
                    const routes = await trx("pharmacy_payment_routes").where({ branchid: this.branch });
                    if (!routes.length)
                         throw new Error("Ask the pharmacy manager to configure at least one payment method first.");
                    await resolvePharmacyDestination(trx, this.branch, routes[0].method);
               }
               const id = randomUUID();
               await trx("pharmacy_shifts").insert({
                    id,
                    branchid: this.branch,
                    cashier_id: this.actor,
                    active_key: this.branch + ":" + this.actor,
                    financial_date: date,
                    opening_float: float,
                    opened_at: new Date(),
               });
               return { id, financialDate: date };
          });
     }

     async closeShift(input: any, managedCashierId?: number) {
          const counted = validAmount(input.countedCash, "counted cash", true);
          const cashier = managedCashierId ?? this.actor;
          return this.db.transaction(async (trx: any) => {
               const snapshot = await trx("pharmacy_shifts")
                    .where(
                         input.shiftId
                              ? { id: input.shiftId, branchid: this.branch, cashier_id: cashier }
                              : { active_key: this.branch + ":" + cashier },
                    )
                    .first();
               if (!snapshot) throw new Error("No pharmacy shift found for this cashier.");
               if (snapshot.closed_at)
                    return {
                         expectedCash: Number(snapshot.expected_cash),
                         countedCash: Number(snapshot.counted_cash),
                         variance: Number(snapshot.variance),
                    };
               await assertPharmacyDayOpen(trx, this.branch, this.shiftDate(snapshot));
               const shift = await trx("pharmacy_shifts").where({ id: snapshot.id }).forUpdate().first();
               if (shift.closed_at)
                    return {
                         expectedCash: Number(shift.expected_cash),
                         countedCash: Number(shift.counted_cash),
                         variance: Number(shift.variance),
                    };
               const totals = await this.shiftTotals(trx, shift),
                    variance = money(counted - totals.expectedCash);
               await trx("pharmacy_shifts")
                    .where({ id: shift.id })
                    .update({
                         active_key: null,
                         counted_cash: counted,
                         expected_cash: totals.expectedCash,
                         variance,
                         closed_at: new Date(),
                         closed_by: this.actor,
                    });
               return { ...totals, countedCash: counted, variance };
          });
     }

     async closeManagedShift(id: string, input: any) {
          const shift = await this.db("pharmacy_shifts").where({ id, branchid: this.branch }).first();
          if (!shift) throw new Error("Cashier shift not found in this branch");
          return this.closeShift({ ...input, shiftId: id }, Number(shift.cashier_id));
     }

     async shiftHandover(id: string) {
          const shift = await this.db("pharmacy_shifts").where({ id, branchid: this.branch }).first();
          if (!shift) throw new Error("Cashier shift not found in this branch");
          const totals = await this.shiftTotals(this.db, shift);
          return {
               shiftId: shift.id,
               cashierId: shift.cashier_id,
               financialDate: this.shiftDate(shift),
               closed: !!shift.closed_at,
               reviewed: !!shift.reviewed_by,
               ...totals,
               expectedCash: shift.closed_at ? Number(shift.expected_cash) : totals.expectedCash,
               currentExpectedCash: totals.expectedCash,
               countedCash: shift.closed_at ? Number(shift.counted_cash) : null,
               variance: shift.closed_at ? Number(shift.variance) : null,
          };
     }

     async closeDay(input: any) {
          const date = text(input.date, "financial date", 10);
          if (
               !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
               !Number.isFinite(Date.parse(date)) ||
               new Date(date).toISOString().slice(0, 10) !== date
          )
               throw new Error("Choose a valid financial date");
          if (date > new Date().toISOString().slice(0, 10)) throw new Error("Cannot close a future financial day");
          return this.db.transaction(async (trx: any) => {
               const snapshot = await trx("pharmacy_financial_days")
                    .where({ branchid: this.branch, financial_date: date })
                    .first();
               if (!snapshot) throw new Error("This financial day has not been opened.");
               if (snapshot.status === "closed") return { date, closed: true };
               await assertPharmacyDayOpen(trx, this.branch, date);
               if (
                    await trx("pharmacy_shifts")
                         .where({ branchid: this.branch })
                         .whereNotNull("active_key")
                         .whereRaw("COALESCE(financial_date, DATE(opened_at)) <= ?", [date])
                         .first()
               )
                    throw new Error("Close the cashier shifts for this financial day first.");
               if (
                    await trx("pharmacy_shifts")
                         .where({ branchid: this.branch })
                         .whereNotNull("closed_at")
                         .whereNull("reviewed_by")
                         .whereRaw("COALESCE(financial_date, DATE(opened_at)) <= ?", [date])
                         .first()
               )
                    throw new Error("Review the closed cashier shifts before closing this financial day.");
               const balances = await trx("pharmacy_journal_lines as l")
                    .join("pharmacy_journals as j", "j.id", "l.journal_id")
                    .where("j.branchid", this.branch)
                    .where("j.financial_date", date)
                    .select("l.account_code")
                    .sum("l.debit as debit")
                    .sum("l.credit as credit")
                    .groupBy("l.account_code");
               await trx("pharmacy_financial_days")
                    .where({ branchid: this.branch, financial_date: date })
                    .update({ status: "closed", closed_by: this.actor, closed_at: new Date() });
               await trx("pharmacy_financial_day_events").insert({
                    id: randomUUID(),
                    branchid: this.branch,
                    financial_date: date,
                    event_type: "closed",
                    reason: String(input.reason || "Financial day closed").slice(0, 500),
                    performed_by: this.actor,
                    details: JSON.stringify({ previousStatus: snapshot.status, balances }),
                    created_at: new Date(),
               });
               return { date, closed: true };
          });
     }

     async reopenDay(input: any) {
          const date = text(input.date, "financial date", 10),
               reason = text(input.reason, "reopening reason", 500);
          const today = new Date().toISOString().slice(0, 10);
          if (
               !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
               !Number.isFinite(Date.parse(date)) ||
               new Date(date).toISOString().slice(0, 10) !== date
          )
               throw new Error("Choose a valid financial date");
          if (date > today) throw new Error("A future pharmacy financial day cannot be reopened");
          if (reason.length < 10) throw new Error("Enter a clear reopening reason of at least 10 characters");
          return this.db.transaction(async (trx: any) => {
               const day = await trx("pharmacy_financial_days")
                    .where({ branchid: this.branch, financial_date: date })
                    .forUpdate()
                    .first();
               if (!day) throw new Error("This financial day has not been opened.");
               if (day.status === "open") return { date, reopened: true, alreadyOpen: true };
               if (
                    input.expectedClosedAt &&
                    new Date(input.expectedClosedAt).getTime() !== new Date(day.closed_at).getTime()
               )
                    throw new Error("The day was closed again by another user. Reload its history before reopening");
               if (
                    await trx("pharmacy_shifts")
                         .where({ branchid: this.branch, financial_date: date })
                         .whereNotNull("active_key")
                         .first()
               )
                    throw new Error(
                         "This day still has an active shift; close or resolve that shift before reopening.",
                    );
               await trx("pharmacy_financial_day_events").insert({
                    id: randomUUID(),
                    branchid: this.branch,
                    financial_date: date,
                    event_type: "reopened",
                    reason,
                    performed_by: this.actor,
                    details: JSON.stringify({
                         previousClosedBy: day.closed_by || null,
                         previousClosedAt: day.closed_at || null,
                    }),
                    created_at: new Date(),
               });
               await trx("pharmacy_financial_days")
                    .where({ id: day.id })
                    .update({ status: "open", closed_by: null, closed_at: null });
               return { date, reopened: true };
          });
     }

     async reviewShift(id: string, input: any) {
          const note = text(input.note, "shift review note", 500);
          return this.db.transaction(async (trx: any) => {
               const snapshot = await trx("pharmacy_shifts").where({ id, branchid: this.branch }).first();
               if (!snapshot || !snapshot.closed_at) throw new Error("A closed pharmacy shift is required");
               await assertPharmacyDayOpen(trx, this.branch, this.shiftDate(snapshot));
               const shift = await trx("pharmacy_shifts").where({ id, branchid: this.branch }).forUpdate().first();
               if (shift.reviewed_by) return { reviewed: true };
               if (Number(shift.cashier_id) === this.actor) {
                    if (!roleAllowed(this.actorRole, ["admin"]))
                         throw new Error("Another pharmacy manager must review your shift");
                    if (input.adminSelfReview !== true)
                         throw new Error("Confirm the administrator self-review acknowledgement.");
                    if (note.length < 10)
                         throw new Error("Enter an administrator self-review reason of at least 10 characters.");
                    await trx("pharmacy_financial_day_events").insert({
                         id: randomUUID(),
                         branchid: this.branch,
                         financial_date: this.shiftDate(shift),
                         event_type: "admin_self_review",
                         reason: note,
                         performed_by: this.actor,
                         created_at: new Date(),
                         details: JSON.stringify({
                              shiftId: id,
                              cashierId: shift.cashier_id,
                              countedCash: shift.counted_cash,
                              expectedCash: shift.expected_cash,
                              variance: shift.variance,
                              role: this.actorRole,
                         }),
                    });
               }
               await trx("pharmacy_shifts")
                    .where({ id })
                    .update({ reviewed_by: this.actor, reviewed_at: new Date(), review_note: note });
               return { reviewed: true };
          });
     }

     async reconcileDestination(input: any) {
          const counted = validAmount(input.statementBalance, "statement balance", true);
          const note = text(input.note, "reconciliation note", 500);
          return this.document("reconciliation", input, async (trx, id) => {
               const account = await trx("pharmacy_collection_accounts")
                    .where({ id: input.accountId, branchid: this.branch, is_active: true })
                    .forUpdate()
                    .first();
               if (!account) throw new Error("Pharmacy destination not found in this branch");
               const expected = await this.accountBalance(trx, `collection:${account.id}`);
               return {
                    amount: counted,
                    details: {
                         accountId: account.id,
                         expected,
                         statementBalance: counted,
                         variance: money(counted - expected),
                         note,
                    },
               };
          });
     }
     async manualJournal(input: any) {
          if (
               input.confirmed !== true ||
               !Array.isArray(input.lines) ||
               !input.lines.length ||
               input.lines.length > 100
          )
               throw new Error("Confirm a reviewed pharmacy journal with 1 to 100 lines");
          const description = text(input.description, "journal description", 500);
          return this.document("manual_journal", input, async (trx, id) => {
               const accounting = await trx("pharmacy_accounting_settings").where({ branchid: this.branch }).forUpdate().first();
               if (Number(accounting?.enabled)) throw new Error("Use the Pharmacy Accounting draft, approval and posting workflow for manual journals");
               const lines = [];
               for (const line of input.lines) {
                    const code = text(line.account, "account", 100);
                    if (code.startsWith("collection:")) {
                         const account = await trx("pharmacy_collection_accounts")
                              .where({ id: Number(code.split(":")[1]), branchid: this.branch, is_active: true })
                              .first();
                         if (!account) throw new Error("Invalid pharmacy collection account");
                         if (
                              account.account_type === "cash" &&
                              (await trx("pharmacy_shifts")
                                   .where({ branchid: this.branch })
                                   .whereNotNull("active_key")
                                   .first())
                         )
                              throw new Error(
                                   "Close pharmacy shifts before posting cash opening balances or corrections",
                              );
                    } else if (code.startsWith("payable:")) {
                         if (
                              !(await trx("pharmacy_suppliers")
                                   .where({ id: code.slice(8), branchid: this.branch, is_active: true })
                                   .first())
                         )
                              throw new Error("Invalid pharmacy payable account");
                    } else if (
                         !["opening_equity", "sales", "cost_of_sales", "inventory", "operating_expenses"].includes(code)
                    )
                         throw new Error("Unknown pharmacy account");
                    lines.push({
                         account: code,
                         debit: validAmount(line.debit ?? 0, "debit", true),
                         credit: validAmount(line.credit ?? 0, "credit", true),
                    });
               }
               const financialDate = input.financialDate || new Date().toISOString().slice(0, 10);
               if (financialDate > new Date().toISOString().slice(0, 10))
                    throw new Error("Correction journals cannot be dated in the future");
               await postPharmacyJournal(
                    trx,
                    this.branch,
                    id,
                    "manual_journal",
                    description,
                    this.actor,
                    lines,
                    financialDate,
               );
               return {
                    amount: money(lines.reduce((sum, line) => sum + line.debit, 0)),
                    details: { description, lines, financialDate },
               };
          });
     }

     async legacyPreview() {
          if (
               !(await this.db.schema.hasTable("inv_inventory_items")) ||
               !(await this.db.schema.hasColumn("inv_inventory_items", "inventory_domain"))
          )
               return [];
          return this.db("inv_inventory_items")
               .where({ inventory_domain: "pharmacy" })
               .whereNotIn("id", this.db("pharmacy_inventory_items").select("id"))
               .select("id", "name", "sku", "current_stock", "cost_price", "pharmacy_batch_tracking");
     }
     async importLegacy(input: any) {
          if (
               input.confirmOpeningBalances !== true ||
               !Array.isArray(input.itemIds) ||
               !input.itemIds.length ||
               input.itemIds.length > 500 ||
               new Set(input.itemIds).size !== input.itemIds.length
          )
               throw new Error("Select up to 500 legacy items and confirm opening stock ownership for this branch");
          return this.document("opening_stock", input, async (trx, id) => {
               const items = await trx("inv_inventory_items")
                    .where({ inventory_domain: "pharmacy" })
                    .whereIn("id", [...input.itemIds].sort())
                    .orderBy("id")
                    .forUpdate();
               if (items.length !== input.itemIds.length) throw new Error("Some legacy pharmacy items were not found");
               let total = new Decimal(0);
               for (const item of items) {
                    if (await trx("pharmacy_inventory_items").where({ id: item.id }).first())
                         throw new Error(`${item.name} has already been imported`);
                    const stock = Number(item.current_stock),
                         cost = validAmount(Number(item.cost_price || 0), "legacy unit cost", true);
                    if (!Number.isFinite(stock) || stock < 0 || quantity(stock) !== stock)
                         throw new Error("Reconcile invalid legacy stock first");
                    await trx("pharmacy_inventory_items").insert({
                         id: item.id,
                         branchid: this.branch,
                         name: item.name,
                         sku: item.sku,
                         consumption_unit: String(item.consumption_unit || "unit"),
                         current_stock: stock,
                         min_stock: item.min_stock || 0,
                         cost_price: cost,
                         sale_price: item.sale_price || 0,
                         wholesale_price: item.wholesale_price || 0,
                         requires_prescription: Boolean(item.requires_prescription),
                         pharmacy_batch_tracking: Boolean(item.pharmacy_batch_tracking),
                         is_active: Boolean(item.is_active),
                         status: resolveStockStatus(stock, Number(item.min_stock || 0)),
                    });
                    // Copy movement history to preserve batch balances and traceability; never replay it as new income.
                    const movements = await trx("inv_inventory_transactions").where({ item_id: item.id }).orderBy("id");
                    for (const movement of movements)
                         await trx("pharmacy_stock_movements").insert({
                              id: `LEG-${movement.id}`.slice(0, 64),
                              item_id: item.id,
                              branchid: this.branch,
                              transaction_type: movement.transaction_type,
                              quantity: movement.quantity,
                              previous_stock: movement.previous_stock,
                              new_stock: movement.new_stock,
                              unit_cost: movement.unit_cost || 0,
                              total_cost: movement.total_cost || 0,
                              reason: "Legacy pharmacy stock history",
                              reference_id: String(movement.reference_id || id),
                              performed_by: this.actor,
                              transaction_date: movement.transaction_date || new Date(),
                              batch_number: movement.batch_number,
                              expiry_date: movement.expiry_date,
                              notes: `Imported by ${id}`,
                         });
                    total = total.plus(money(new Decimal(stock).mul(cost)));
               }
               const amount = money(total);
               if (amount)
                    await postPharmacyJournal(
                         trx,
                         this.branch,
                         id,
                         "opening_stock",
                         "Approved pharmacy opening stock",
                         this.actor,
                         [
                              { account: "inventory", debit: amount },
                              { account: "opening_equity", credit: amount },
                         ],
                    );
               return { amount, details: { itemIds: input.itemIds, branch: this.branch } };
          });
     }
}

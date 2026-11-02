import { Knex } from "knex";
import Decimal from "decimal.js";

export async function pharmacyInventoryReconciliation(db: Knex | Knex.Transaction, branch: number) {
     if (!Number.isSafeInteger(branch) || branch < 1) throw new Error("An operating pharmacy branch is required");
     const asOf = new Date().toISOString().slice(0, 10);
     const items = await db("pharmacy_inventory_items")
          .where({ branchid: branch })
          .select("id", "name", "sku", "current_stock", "cost_price")
          .orderBy("name")
          .limit(10001);
     if (items.length > 10000)
          throw new Error(
               "Inventory reconciliation is limited to 10,000 medicines; use a reviewed inventory reconciliation batch",
          );
     const rows = items.map((item) => {
          const quantity = new Decimal(item.current_stock),
               cost = new Decimal(item.cost_price);
          if (!quantity.isFinite() || !cost.isFinite() || quantity.lt(0) || cost.lt(0))
               throw new Error(`Invalid stock quantity or weighted-average cost for ${item.sku}`);
          return {
               itemId: item.id,
               name: item.name,
               sku: item.sku,
               quantity: quantity.toNumber(),
               unitCost: cost.toNumber(),
               value: quantity.mul(cost).toDecimalPlaces(2).toNumber(),
          };
     });
     const balances = await db("pharmacy_journal_lines as l")
          .join("pharmacy_journals as j", "j.id", "l.journal_id")
          .where("j.branchid", branch)
          .where("j.financial_date", "<=", asOf)
          .whereIn("l.account_code", [
               "inventory",
               "quarantine_inventory",
               "stock_in_transit",
               "inventory_in_transit",
               "supplier_returns_pending",
          ])
          .select("l.account_code as account")
          .sum("l.debit as debit")
          .sum("l.credit as credit")
          .groupBy("l.account_code");
     const controls = balances.map((row) => ({
          account: String(row.account),
          balance: new Decimal(row.debit).minus(row.credit).toNumber(),
     }));
     const stockValue = rows.reduce((sum, row) => sum.plus(row.value), new Decimal(0)),
          inventoryControl = controls.find((row) => row.account === "inventory")?.balance || 0;
     const difference = stockValue.minus(inventoryControl);
     return {
          asOf,
          branchid: branch,
          rows,
          stockValue: stockValue.toNumber(),
          inventoryControl,
          difference: difference.toNumber(),
          balanced: difference.isZero(),
          controls,
          policy: "Current on-hand quantity at persisted moving weighted-average cost, rounded per medicine. Quarantine, transit and pending supplier-return assets are shown separately, not silently included in on-hand value. Historical physical snapshots are not inferred from current stock.",
          correctionPolicy:
               "Investigate missing openings, stock movements and cost rounding. Correct only through an approved stock or financial adjustment; no automatic balancing entry is generated.",
     };
}

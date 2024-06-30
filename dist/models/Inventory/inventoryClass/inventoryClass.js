"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const helper_1 = require("../../../../helper");
class Inventory {
    constructor(stockid) {
        this.stockid = stockid;
    }
    async checkStockExist(stockname) {
        const item = await (0, helper_1.promisifyQuery)(`SELECT * FROM generalstocks WHERE name = ?`, [stockname]);
        return item.length > 0;
    }
    async addNewStock(records) {
        const { name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, warehouse, shelf } = records;
        if (await this.checkStockExist(name))
            return "EXIST";
        if (!category || typeof category !== "number" || !name)
            throw new Error("category of type number required and name required");
        const values = [name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, warehouse, shelf];
        const pushStock = await (0, helper_1.promisifyQuery)(queries_1.NEWSTOCKQUERY, values);
        return (0, helper_1.rowAffected)(pushStock);
    }
    async updateAstock(records) {
        const { stockid, name, category, consumptionunit, purchaseunit, alertlevel, materialcode, warehouse, shelf, date } = records;
        if (!stockid)
            throw new Error("stockid required");
        if (!category || typeof category !== "number" || !(category > 0))
            throw new Error("category must be a number greater than 0");
        const values = [consumptionunit, purchaseunit, alertlevel, materialcode, date, name, category, warehouse, shelf, stockid];
        const update = await (0, helper_1.promisifyQuery)(queries_1.UPDATEASTOCKQUERY, values);
        return (0, helper_1.rowAffected)(update);
    }
    async deleteAstock(stockid) {
        if (!stockid || typeof stockid !== "number")
            throw new Error("stockid required");
        return await (0, helper_1.promisifyQuery)(queries_1.DELETEASTOCKQUERY, [parseInt(stockid.toString())]);
    }
    async getStocks(query, warehouseid) {
        let data = [];
        let newQuery = queries_1.GETGENERALSTOCK;
        if (warehouseid && warehouseid !== "all") {
            newQuery += ` WHERE ns.warehouse = ? LIMIT ? OFFSET ?`;
            data = await (0, helper_1.paginationQuery)(query, newQuery, [parseInt(warehouseid.toString())]);
            return data;
        }
        newQuery += ` LIMIT ? OFFSET ?`;
        return await (0, helper_1.paginationQuery)(query, newQuery);
    }
    async getAstock(stockid) {
        if (!stockid)
            return;
        return await (0, helper_1.promisifyQuery)(`SELECT * FROM generalstocks WHERE stockid = ?`, [stockid]);
    }
    async getMainSupplyStock(stockid, brandid) {
        if (!brandid || !stockid)
            return new Error("stockid and brandid required");
        return await (0, helper_1.promisifyQuery)(`SELECT *  FROM mainstoresupply WHERE stockid = ? AND brandid  = ?`, [stockid, brandid]);
    }
    async getExpiredStock(query) {
        return await (0, helper_1.paginationQuery)(query, queries_1.EXPIREDSTOCKSQUERY);
    }
    async addStockCategory(records) {
        const { category } = records;
        if (!category || typeof category !== "string")
            throw new Error("Must be of type string and category required");
        const stockAvailable = await (0, helper_1.promisifyQuery)("SELECT * FROM stockcategory WHERE category = ?", [category]);
        if (stockAvailable.length > 0)
            return 1;
        const insertion = await (0, helper_1.promisifyQuery)("INSERT INTO stockcategory (category) VALUE (?)", [category]);
        return (0, helper_1.rowAffected)(insertion);
    }
    async getStockCategory() {
        return await (0, helper_1.promisifyQuery)(`SELECT * FROM stockcategory`);
    }
    async updateStockCategory(records) {
        const { id, category } = records;
        if (!id || !category)
            throw new Error("category and id required");
        const stockAvailable = await (0, helper_1.promisifyQuery)("SELECT * FROM stockcategory WHERE category = ?", [category]);
        if (stockAvailable.length === 0)
            return 1;
        const updateCat = await (0, helper_1.promisifyQuery)("UPDATE stockcategory SET category = ? WHERE id = ?", [category, parseInt(id.toString())]);
        return (0, helper_1.rowAffected)(updateCat);
    }
    async deleteStockCategory(stockid) {
        if (!stockid)
            throw new Error("stockid required");
        const isdeleted = await (0, helper_1.promisifyQuery)(queries_1.DELETESTOCKCATEGORY, [stockid]);
        return (0, helper_1.rowAffected)(isdeleted);
    }
    async getGeneralUnExpiredStocks(requestQuery) {
        return await (0, helper_1.paginationQuery)(requestQuery, queries_1.GENERALUNEXPIREDSTOCKS);
    }
    async deleteStockBrand(records) {
        const { stockid, brandid } = records;
        if (!stockid || !brandid)
            return "stockid and brandid are required";
        const deleteResult = await (0, helper_1.promisifyQuery)(queries_1.DELETESTOCKABRANDQUERY, [stockid, brandid]);
        return (0, helper_1.rowAffected)(deleteResult);
    }
}
exports.default = Inventory;

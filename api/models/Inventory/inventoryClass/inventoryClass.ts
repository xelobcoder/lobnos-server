import {
  NEWSTOCKQUERY,
  DELETESTOCKABRANDQUERY,
  GETGENERALSTOCK,
  EXPIREDSTOCKSQUERY,
  GENERALUNEXPIREDSTOCKS,
  UPDATEASTOCKQUERY,
  DELETEASTOCKQUERY,
  FILTERSTOCKQUERY,
  EXPIREDPRODUCTSMINI,
  GETMAINSTORESUPPLY,
  UPDATEMAINSTORESUPPLY,
  GETSTOCKCATEGORIES,
  INSERTSTOCKCATEGORY,
  UPDATESTOCKCATEGORY,
  DELETESTOCKCATEGORY,
} from "./queries";

import { promisifyQuery, rowAffected, paginationQuery, customError } from "../../../../helper";


class Inventory {
  private stockid: number;

  constructor(stockid?: number) {
    this.stockid = stockid;
  }

  public async checkStockExist(stockname: string): Promise<boolean> {
    const item = await promisifyQuery(`SELECT * FROM generalstocks WHERE name = ?`, [stockname]);
    return item.length > 0;
  }

  public async addNewStock(records: any): Promise<any> {
    const { name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, warehouse, shelf } = records;
    if (await this.checkStockExist(name)) return "EXIST";

    if (!category || typeof category !== "number" || !name) throw new Error("category of type number required and name required");
    const values = [name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, warehouse, shelf];

    const pushStock = await promisifyQuery(NEWSTOCKQUERY, values);
    return rowAffected(pushStock);
  }

  public async updateAstock(records: any): Promise<any> {
    const { stockid, name, category, consumptionunit, purchaseunit, alertlevel, materialcode, warehouse, shelf, date } = records;
    if (!stockid) throw new Error("stockid required");
    if (!category || typeof category !== "number" || !(category > 0)) throw new Error("category must be a number greater than 0");
    const values = [consumptionunit, purchaseunit, alertlevel, materialcode, date, name, category, warehouse, shelf, stockid];
    const update = await promisifyQuery(UPDATEASTOCKQUERY, values);
    return rowAffected(update);
  }

  public async deleteAstock(stockid: number): Promise<any> {
    if (!stockid || typeof stockid !== "number") throw new Error("stockid required");
    return await promisifyQuery(DELETEASTOCKQUERY, [parseInt(stockid.toString())]);
  }

  public async getStocks(query: any, warehouseid?: number | string): Promise<any> {
    let data = [];
    let newQuery = GETGENERALSTOCK;
    if (warehouseid && warehouseid !== "all") {
      newQuery += ` WHERE ns.warehouse = ? LIMIT ? OFFSET ?`;
      data = await paginationQuery(query, newQuery, [parseInt(warehouseid.toString())]);
      return data;
    }
    newQuery += ` LIMIT ? OFFSET ?`;
    return await paginationQuery(query, newQuery);
  }

  public async getAstock(stockid: number): Promise<any> {
    if (!stockid) return;
    return await promisifyQuery(`SELECT * FROM generalstocks WHERE stockid = ?`, [stockid]);
  }

  public async getMainSupplyStock(stockid: number, brandid: number): Promise<any> {
    if (!brandid || !stockid) return new Error("stockid and brandid required");
    return await promisifyQuery(`SELECT *  FROM mainstoresupply WHERE stockid = ? AND brandid  = ?`, [stockid, brandid]);
  }

  public async getExpiredStock(query: any): Promise<any> {
    return await paginationQuery(query, EXPIREDSTOCKSQUERY);
  }

  public async addStockCategory(records: any): Promise<any> {
    const { category } = records;
    if (!category || typeof category !== "string") throw new Error("Must be of type string and category required");
    const stockAvailable = await promisifyQuery("SELECT * FROM stockcategory WHERE category = ?", [category]);
    if (stockAvailable.length > 0) return 1;
    const insertion = await promisifyQuery("INSERT INTO stockcategory (category) VALUE (?)", [category]);
    return rowAffected(insertion);
  }

  public async getStockCategory(): Promise<any> {
    return await promisifyQuery(`SELECT * FROM stockcategory`);
  }

  public async updateStockCategory(records: any): Promise<any> {
    const { id, category } = records;
    if (!id || !category) throw new Error("category and id required");
    const stockAvailable = await promisifyQuery("SELECT * FROM stockcategory WHERE category = ?", [category]);
    if (stockAvailable.length === 0) return 1;
    const updateCat = await promisifyQuery("UPDATE stockcategory SET category = ? WHERE id = ?", [category, parseInt(id.toString())]);
    return rowAffected(updateCat);
  }

  public async deleteStockCategory(stockid: number): Promise<any> {
    if (!stockid) throw new Error("stockid required");
    const isdeleted = await promisifyQuery(DELETESTOCKCATEGORY,[stockid]);
    return rowAffected(isdeleted);
  }

  public async getGeneralUnExpiredStocks(requestQuery: any): Promise<any> {
    return await paginationQuery(requestQuery, GENERALUNEXPIREDSTOCKS);
  }

  public async deleteStockBrand(records: any): Promise<any> {
    const { stockid, brandid } = records;
    if (!stockid || !brandid) return "stockid and brandid are required";

    const deleteResult = await promisifyQuery(DELETESTOCKABRANDQUERY, [stockid, brandid]);

    return rowAffected(deleteResult);
  }
}

export default Inventory;

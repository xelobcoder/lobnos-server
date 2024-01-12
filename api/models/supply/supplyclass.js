const database_queries = require('../../database/queries')
const { promisifyQuery, paginationQuery } = require('../../../helper')

const NEWSUPPLIERQUERY = `INSERT INTO supplier (name,address,email,contactperson,region,phonenumber) VALUES (?,?,?,?,?,?)`;
const GETSUPPLIERSQUERY = `SELECT * FROM supplier ORDER BY supplierid DESC LIMIT ? OFFSET ?`;
const UPDATESUPPLIERQUERY = `UPDATE supplier SET name = ?, address = ?, region = ?, contactperson = ?, email = ?, phonenumber = ? WHERE supplierid = ?`;

class Supplys {
  constructor(supplierid) {
    this.supplierid = supplierid;
  }

  async addSupplier(records) {
    const { name, address, email, contactperson, region, phonenumber } = records;
    const result = await promisifyQuery(NEWSUPPLIERQUERY, [name, address, email, contactperson, region, phonenumber]);
    return result.insertId != null;
  }

  async deleteSupplier(id) {
    if (!id) return false;
    const isdelted = await database_queries.del([supplierid], 'supplier', 'supplierid');
    return isdelted.affectedRows > 0;
  }

  async getSuppliers(data) {
    try {
      return paginationQuery(data, GETSUPPLIERSQUERY);
    } catch (err) {
      throw new Error(err);
    }
  }
  async updateSupplier(records) {
    const { name, address, region, contactperson, email, phonenumber, supplierid } = records;
    if (!supplierid) return false;
    const values = [name, address, region, contactperson, email, phonenumber, supplierid];
    const outcome = await promisifyQuery(UPDATESUPPLIERQUERY, values);
    return outcome.affectedRows > 0 ? true : null;
  }

  async getSupplier(supplierid) {
    if (!supplierid) return false;
    return await database_queries.getsingleid([supplierid], 'supplier', 'SUPPLIERID');
  }

  async postCommodity(records) {
    const { name, category } = records;
    if (!name || !category) throw new Error("name and category required");
    const query = `INSERT INTO commodity (COMMODITY,CATEGORY) VALUES (?,?)`;
    const result = await promisifyQuery(query, [name, category]);
    return result.insertId != null;
  }

  async getCommodity(commodity) {
    if (!commodity) throw new Error("commodity required");
    return await database_queries.getsingleid(commodity, "commodity", "commodity");
  }

  async getCommodities(query) {
    return await paginationQuery(query, `SELECT * FROM commodity GROUP BY comid LIMIT ? OFFSET ?`);
  }
  
}

module.exports = Supplys;

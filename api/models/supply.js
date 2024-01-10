const connection = require('../db')
const database_queries = require('../database/queries')
const { promisifyQuery, paginationQuery } = require('../../helper')

const NEWSUPPLIERQUERY = `INSERT INTO supplier (name,address,email,contactperson,region,phonenumber) VALUES (?,?,?,?,?,?)`;
const GETSUPPLIERSQUERY = `SELECT * FROM supplier ORDER BY supplierid DESC LIMIT ? OFFSET ?`;
const UPDATESUPPLIERQUERY = `UPDATE supplier SET name = ?, address = ?, region = ?, contactperson = ?, email = ?, phonenumber = ? WHERE supplierid = ?`;
const NEWSTOCKQUERY = `INSERT INTO generalstocks (name,category,consumptionunit,purchaseunit,quantity,alertlevel,materialcode) VALUES (?,?,?,?,?,?,?)`;
const GETGENERALSTOCK = ` SELECT 
                      ns.name as name,
                      ns.stockid as stockid,
                      sc.category as category,
                      ns.consumptionunit as consumptionunit,
                      ns.purchaseunit as purchaseunit,
                      ns.quantity as quantity,
                      ns.date as date,
                      ns.alertlevel as alertlevel,
                      ns.materialcode as materialcode
                      FROM generalstocks AS ns INNER JOIN stockcategory AS sc ON sc.id = ns.category
                      LIMIT ? OFFSET ?`;

const EXPIREDSTOCKSQUERY = `SELECT productordersid, stockid, quantity, expirydate, received, receiveddate, expirydate, Batchnumber, name, suppliername, purchaseunit FROM orders WHERE RECEIVED = 'TRUE' AND DATE(expirydate) < DATE(NOW()) ORDER BY expirydate ASC LIMIT ? OFFSET ?`;

const GENERALUNEXPIREDSTOCKS = `SELECT * FROM generalstocks WHERE expirydate >= NOW() AND status = 'received' ORDER BY productordersid LIMIT ? OFFSET ?`;

const UPDATEASTOCKQUERY = `UPDATE generalstocks SET   consumptionunit = ?,  purchaseunit = ?,  quantity = ?,  alertlevel = ?,  materialcode = ?,  date = ?,  name = ?,  category = ? WHERE stockid = ?`;

const DELETEASTOCKQUERY = `DELETE FROM newstock WHERE stockid = ?`;

const FILTERSTOCKQUERY = `SELECT 
        gs.stockid,
        gs.name,
        sc.category,
        gs.consumptionunit,
        gs.quantity
    FROM generalstocks AS gs
    INNER JOIN stockcategory AS  sc ON sc.id = gs.category
    WHERE gs.name  LIKE ? OR sc.category LIKE ? ORDER BY gs.name LIMIT ? OFFSET ?`;
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
    return await database_queries.del([supplierid], 'supplier', 'supplierid');
  }

  async getSuppliers(data) {
    try {
      return paginationQuery(data,GETSUPPLIERSQUERY);
    } catch (err) {
      throw new Error(err);
    }
  }
  async updateSupplier(supplierid, records) {
    if (supplierid) return false;
    const { name, address, region, contactperson, email, phonenumber } = records;
    const values = [name, address, region, contactperson, email, phonenumber, supplierid];
    return await promisifyQuery(UPDATESUPPLIERQUERY, values);
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
        return result;
    }
  
}






  // let items_found_in_db = 0;

  // const checkCommodityExist = (commodity) => {

  //   let query = `SELECT * FROM commodity WHERE COMMODITY = ?`

  //   connection.query(query, [commodity.name], function (err, result) {
  //     if (err) {
  //       response.send({
  //         status: 'error',
  //         err,
  //       })
  //     }
  //     if (result) {
  //       if (result.length === 0) {
  //         insertCommodity(commodity)
  //       }
  //       else {
  //         items_found_in_db++;
  //       }
  //     }
  //   })
  // }

  // if (isArray && !isSingle) {
  //   let target = datasource.length
  //   let counter = 0
  //   while (counter < target) {
  //     checkCommodityExist(datasource[counter])
  //     counter++
  //   }
  //   if (counter === target) {
  //     response.send({
  //       status: 'success',
  //       message: 'commodity added successfully to the database however some commodity already exist in the database',
  //     })
  //   }
  // }
  // else {
  //   response.send({
  //     status: 'error',
  //     message: 'no commodity provided',
  //   })
  // }


// const getCommodity = async function (request, response) {
//   let query = `SELECT * FROM commodity`
//   connection.query(query, function (err, result) {
//     if (err) {
//       response.send({
//         status: 'error',
//         err,
//       })
//     }
//     if (result) {
//       response.send({
//         status: 'success',
//         result,
//       })
//     }
//   })
// }


class Inventory {
  constructor(stockid) {
    this.stockid = stockid || null;
  }

  async checkStockExist(stockname) {
    const item = await database_queries.getsingleid(stockname, "generalstocks", "name");
    return item.length > 0;
  }

 async  addNewStock(records) {
   const { name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode } = records;
   if (this.checkStockExist(name)) return false;

   const values =  [ name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode]
   const pushStock = await promisifyQuery(NEWSTOCKQUERY, values);

   return pushStock.affectedRows > 0;
  }

  async updateAstock(records) {
    const { stockid, name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, tax, date } = records;
    if (stockid) throw new Error("stockid required");
    const values = [consumptionunit, purchaseunit, quantity, alertlevel, materialcode, date, name, category, stockid];
    const update = await promisifyQuery(UPDATEASTOCKQUERY, values);
    return update.affectedRows > 0;
  }

    async deleteAstock(stockid) {
      if (!stockid || typeof stockid !== 'number') throw new Error("stockid required");

      return await promisifyQuery(DELETEASTOCKQUERY, [parseInt(stockid)])
  }

   async getStocks(query) {
      const data = await paginationQuery(query,GETGENERALSTOCK);
      return data;
  } 

  async getAstock(stockid) {
    if (!stockid) return;
    return await promisifyQuery(`SELECT * FROM generalstocks WHERE stockid = ?`, [stockid]);
  }

  async getExpiredStock(query) {
    return await paginationQuery(query, EXPIREDSTOCKSQUERY);
  }

  async addStockCategory(records) {
      const { category } = records;
      if (!category || typeof category != "string") throw new Error("Must be of type string and category required");
      const stockAvailable = await promisifyQuery('SELECT * FROM stockcategory WHERE category = ?', [category]);
      if (stockAvailable.length > 0) return false;
      const insertion = await promisifyQuery('INSERT INTO stockcategory (category) VALUES ?', [category]);
      return insertion.affectedRows > 0;
  }

  async getStockCategory() {
    return await promisifyQuery(`SELECT * FROM stockcategory`);
    }

    async deleteStockCategory(stockid) {
        if (!stockid) throw new Error("stockid required");
        const isdeleted = await database_queries.del(id, "stockcategory", "id");
        return isdeleted.affectedRows > 0;
    }

  async getGeneralUnExpiredStocks(requestQuery) {
    return await paginationQuery(requestQuery,GENERALUNEXPIREDSTOCKS);
  }

  async getGeneralExpired(query) {
    return await paginationQuery(query, EXPIREDSTOCKSQUERY);
  }

    async filterstock(filteringValue) {
        if (!filteringValue) return [];
        let data = await paginationQuery(FILTERSTOCKQUERY, [filteringValue, filteringValue]);
        if (data.length === 0) return data;
        data.map((item, index) => { return { ...item, quantityrequired: 0 } });
        return data;
  }

}



module.exports = {
  getCommodity,
  Supplys,
  Inventory
}


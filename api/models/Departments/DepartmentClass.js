const { promisifyQuery, rowAffected } = require("../../../helper");
const Inventory = require('./../Inventory/inventoryclass');
class Departments {
  constructor(departmentid) {
    this.departmentid = departmentid;
  }

  async getPendingdepartmentReqSummary() {
    let query = `SELECT COUNT(hx.id) AS pending,hx.departmentid,d.department
    FROM departmentrequisitionhx AS hx INNER JOIN departments AS d ON hx.departmentid = d.id WHERE quantity_approved IS NULL`;
    if (this.departmentid) {
      query += ` AND departmentid = ?`;
    }
    query += ` GROUP BY hx.departmentid`
    return await promisifyQuery(query, [this.departmentid]);
  }

  async getDeptSpecificReqData(id,type) {
    // join department requisition table with  name of department  table and name of newstock table
    if (!id) return new Error('id required');
  
    let mysql_query = `SELECT  drh.id,
          drh.departmentid, 
          drh.stockid, 
          drh.quantity_requested,
          drh.quantity_approved,
          drh.status,
           drh.date,
           drh.requisitionid,
           drh.comsumptionunit,
           d.department,ns.stockid,
           drh.batchnumber,
           drh.brand,
           ns.name,
           ns.quantity
           FROM departmentrequisitionhx AS drh
          INNER JOIN departments AS d ON d.id = drh.departmentid
          INNER JOIN generalstocks AS ns ON ns.stockid = drh.stockid`
  
  
    if (type === "pending") {
      mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NULL `
    }
  
    if (type === "approved") {
      mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'approved'`
    }
  
    if (type === "rejected") {
      mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'rejected'`
    }
  
    if (type === "received") {
      mysql_query += `WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'received'`
    }
  
    return promisifyQuery(mysql_query,[parseInt(id)]);
  }

  async StoreServeDeptReq() {
    if (!this.departmentid) return new Error('Departmentid Required');

    const pendingReqt = await this.getDeptSpecificReqData(this.departmentid, 'approved');
    let stockidx = [];
    if (pendingReqt.length == 0) return pendingReqt;

    stockidx = pendingReqt.map((reqt, index) => parseInt(reqt.stockid));


    if (stockidx.length === 0) return [];

      const inventory = new Inventory()
      const outPromise =  (data) =>  Promise.all(data)
      const stockBrandsArray = stockidx.map(async (a, i) => {
        // get individual stocks brands using their id (s).
        const data = await inventory.getAstockBrands({ stockid: a })
        const stkbrand = data.map((x, y) => {return x?.brandid})
        return { stockid: a, brands: stkbrand }
      })
  
      const stocksbrands = await outPromise(stockBrandsArray)
      const haveBrands = stocksbrands.filter((a, i) => a.brands.length > 0);
  
  
      let products = []
  
      if (haveBrands.length > 0) {
        products = haveBrands.map(async (u, v) => {
          const { stockid, brands } = u
          const debithx = await promisifyQuery(`SELECT * FROM generalstoredebithx WHERE stockid = ${stockid} AND brandid IN (${brands.join(",")})`);
          return  {...u, debithx}
        });
  
        products = await outPromise(products);
     
        // if debit hx is empty,it means the credit stock hasnt been used so we send the credit hx
        products = products.map(async (v, i) => {
          const { debithx, stockid, brands } = v;
          const data = {};
          if (debithx.length == 0) {
            const credithx = await promisifyQuery(`SELECT * FROM generalstorecredithx
            AS chx INNER JOIN stocksbrands AS sb ON sb.brandid = chx.brandid WHERE chx.stockid = ${stockid} AND chx.brandid IN (${brands.join(",")})`);
            data.stockid = stockid;
            data.debitable = credithx;
          }
          if (debithx.length > 0) {
            let debitable = await inventory.isDebitable(stockid, brands);
            const debitableBrands = debitable.map((x, y) => x?.brandid);
            const creditBrands = [];
  
            for (let i = 0; i < brands.length; i++) {
              if (!debitableBrands.includes(brands[i])) creditBrands.push(brands[i]);
            }
  
            let unCapturedDebitable = await promisifyQuery(`SELECT * FROM generalstorecredithx
            AS chx INNER JOIN stocksbrands AS sb ON sb.brandid = chx.brandid WHERE chx.stockid = ${stockid} AND chx.brandid IN (${creditBrands.join(",")})`);
            data.stockid = stockid;
            data.debitable = [...debitable,...unCapturedDebitable];
            
          }
          
          data.debitable = data.debitable.map((item, index) => {
            if (!item?.storeQty) {
              const { productordersid, stockid, credit, brandid,batchnumber,brand} = item;
              return { storeQty: credit, productordersid, stockid, brandid, batchnumber, brand };
            }
            return item;
          })
          return data
        })
        products = (await outPromise(products)).filter( (u,v) => u.debitable.length > 0)
      }
    
    for (let i = 0; i < pendingReqt.length; i++) {
      for (let j = 0; j < products.length; j++) {
        const toRemove = ['quantity,requisitionid','brand','batchnumber'];
        if (pendingReqt[i]['stockid'] === products[j]['stockid']) {
          pendingReqt[i]['debitable'] = products[j]['debitable'];
          toRemove.map((item, index) => delete pendingReqt[i][item]);
        }
      }
    }

    // pendingReqt = pendingReqt.map

    return pendingReqt;
  }

  async updateRequisitionApproval(quantity,requisitionid,status) {
    if (!requisitionid || !status ) throw new Error('requisitionid && status is required');
    const qty = parseInt(quantity);
    if (isNaN(requisitionid) || isNaN(qty)) throw new Error('valid integers required');

    if (qty < 0) return false;
      const query = `UPDATE departmentrequisitionhx SET quantity_approved = ?,status = ? WHERE  id = ?`;
      const result = await promisifyQuery(query, [quantity,status, requisitionid]);
      return rowAffected(result);
  }

  async updateDepartmentRequisition(records, departmentid) {
    if (!departmentid) throw new Error('Department id required');
    const { quantity_approved, store_supplied, brandid, batchnumber } = records;

    if (!quantity_approved || !store_supplied || !brandid || !batchnumber) {
      throw new Error('records must contain quantity_approved, store_supplied, brandi and batchnumber');
    }
      
    const mysql_query = `UPDATE departmentrequisitionhx
                SET quantity_approved = ?,
                store_supplied = ?,
                batchnumber = ?,
                brand = ?,
          status = 'approved' WHERE id = ?`;

    const values = [quantity_approved, store_supplied, batchnumber, brandid, parseInt(departmentid)];

    return await promisifyQuery(mysql_query, values);
  }
}


module.exports = Departments;
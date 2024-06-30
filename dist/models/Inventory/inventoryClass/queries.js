"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETESTOCKCATEGORY = exports.UPDATESTOCKCATEGORY = exports.INSERTSTOCKCATEGORY = exports.GETSTOCKCATEGORIES = exports.UPDATEMAINSTORESUPPLY = exports.GETMAINSTORESUPPLY = exports.EXPIREDPRODUCTSMINI = exports.FILTERSTOCKQUERY = exports.DELETEASTOCKQUERY = exports.UPDATEASTOCKQUERY = exports.GENERALUNEXPIREDSTOCKS = exports.EXPIREDSTOCKSQUERY = exports.GETGENERALSTOCK = exports.DELETESTOCKABRANDQUERY = exports.NEWSTOCKQUERY = void 0;
exports.NEWSTOCKQUERY = `INSERT INTO generalstocks (name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, warehouse, shelf) VALUES (?,?,?,?,?,?,?,?,?)`;
exports.DELETESTOCKABRANDQUERY = `DELETE FROM stocksbrands WHERE stockid = ? && brandid = ?`;
exports.GETGENERALSTOCK = `
  SELECT 
    ns.name as name,
    ns.stockid as stockid,
    sc.category as categoryname,
    ns.consumptionunit as consumptionunit,
    ns.purchaseunit as purchaseunit,
    ns.quantity as quantity,
    ns.date as date,
    wc.id as warehouse,
    sc.id as category,
    sh.id as shelf,
    ns.alertlevel as alertlevel,
    ns.materialcode as materialcode
  FROM generalstocks AS ns 
  INNER JOIN stockcategory AS sc ON sc.id = ns.category
  INNER JOIN warehouse AS wc ON ns.warehouse = wc.id
  INNER JOIN shelves AS sh ON sh.id = ns.shelf`;
exports.EXPIREDSTOCKSQUERY = `
  SELECT 
    o.productordersid,
    s.brand, 
    o.stockid, 
    o.quantity, 
    o.expirydate, 
    o.received, 
    o.receiveddate, 
    o.expirydate, 
    o.Batchnumber,
    s.brandid, 
    o.name, 
    o.suppliername, 
    o.purchaseunit 
  FROM orders AS o 
  INNER JOIN stocksbrands AS s ON o.brand = s.brandid
  WHERE o.RECEIVED = 'TRUE' 
    AND DATE(o.expirydate) < CURRENT_DATE 
    AND o.expiredDisposed IS NULL 
  ORDER BY o.expirydate ASC 
  LIMIT ? OFFSET ?`;
exports.GENERALUNEXPIREDSTOCKS = `SELECT * FROM generalstocks WHERE expirydate >= NOW() AND status = 'received' ORDER BY productordersid LIMIT ? OFFSET ?`;
exports.UPDATEASTOCKQUERY = `
  UPDATE generalstocks 
  SET consumptionunit = ?,  
      purchaseunit = ?,  
      alertlevel = ?,  
      materialcode = ?,  
      date = ?,  
      name = ?,  
      category = ?, 
      warehouse = ?, 
      shelf = ? 
  WHERE stockid = ?`;
exports.DELETEASTOCKQUERY = `DELETE FROM newstock WHERE stockid = ?`;
exports.FILTERSTOCKQUERY = `
  SELECT 
    gs.stockid,
    gs.name,
    gs.date,
    sc.category,
    gs.consumptionunit,
    gs.alertlevel,
    sc.category AS categoryname,
    gs.quantity
  FROM generalstocks AS gs
  INNER JOIN stockcategory AS  sc ON sc.id = gs.category
  WHERE gs.name  LIKE ? OR sc.category LIKE ?`;
exports.EXPIREDPRODUCTSMINI = `SELECT productordersid FROM orders WHERE RECEIVED = 'TRUE' AND DATE(expirydate) < DATE(NOW())`;
exports.GETMAINSTORESUPPLY = `SELECT * FROM mainstoresupply WHERE stockid = ? AND brandid = ?`;
exports.UPDATEMAINSTORESUPPLY = `UPDATE mainstoresupply SET quantity = ? WHERE stockid = ? AND brandid = ?`;
exports.GETSTOCKCATEGORIES = `SELECT * FROM stockcategory`;
exports.INSERTSTOCKCATEGORY = `INSERT INTO stockcategory (category) VALUES (?)`;
exports.UPDATESTOCKCATEGORY = `UPDATE stockcategory SET category = ? WHERE id = ?`;
exports.DELETESTOCKCATEGORY = `DELETE FROM stockcategory WHERE id = ?`;

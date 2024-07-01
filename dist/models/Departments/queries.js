const q_pending_department_summary = `SELECT COUNT(hx.id) AS pending,hx.departmentid,d.department
    FROM departmentrequisition AS hx INNER JOIN departments AS d ON hx.departmentid = d.id WHERE quantity_approved IS NULL`;
const q_get_specific_dept_requisition_data = `SELECT  drh.id,
                        drh.departmentid, 
                        drh.stockid, 
                        drh.quantity_requested,
                        drh.quantity_approved,
                        drh.status,
                        drh.date,
                        drh.comsumptionunit,
                        d.department,ns.stockid,
                        ns.name,
                        ns.quantity
                        FROM departmentrequisition AS drh
              INNER JOIN departments AS d ON d.id = drh.departmentid
              INNER JOIN generalstocks AS ns ON ns.stockid = drh.stockid`;
const q_has_store_supplied_already = `SELECT store_supplied FROM departmentrequisition WHERE id = ?`;
const q_new_department_reqt = `INSERT INTO departmentrequisitionhx (productordersid, stockid, brandid, batchnumber, qty, requisitionid,departmentid,status)
    VALUES (?, ?, ?, ?, ?,?,?,?)`;
const q_new_Escrow_data = `
      INSERT INTO stocksEsrow (productordersid, stockid, brandid, batchnumber, qty, type,requisitionid,departmentid)
      VALUES (?, ?, ?, ?, ?, ?,?,?)
    `;
const q_escrow_order_exist = `SELECT COUNT(*) as count
      FROM stocksEsrow
      WHERE productordersid = ? AND stockid = ? AND brandid = ? AND batchnumber = ?
    `;
const q_delete_requit_from_escrow = `DELETE  FROM stocksesrow WHERE requisitionid = ?`;
const q_update_dept_requisition = `UPDATE departmentrequisition SET quantity_approved = ?,status = ?, approvedOn = NOW() WHERE  id = ?`;
const q_update_dept_requisition_after_supplied = `UPDATE departmentrequisition SET
                store_supplied = ?
                WHERE id = ?`;

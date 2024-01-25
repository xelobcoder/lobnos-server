const { promisifyQuery, rowAffected, paginationQuery } = require("../../../helper");
const logger = require("../../../logger");
const User = require('../../LobnosAuth/user');
const Departments = require("../Departments/DepartmentClass");

class Requisition extends Departments {
  constructor(requisitionid,departmentid) {
    super(departmentid);
    this.requisitionid = requisitionid; 
  }
  

  async canRequestNew(stockid, departmentid) {
    if (!stockid || !departmentid) {
      throw new Error('departmentid and stockid are required');
    }
    const query = `SELECT * FROM departmentrequisition
    WHERE stockid = ? AND departmentid = ? AND quantity_approved IS NULL`;

   try {
     const result = await promisifyQuery(query, [stockid, departmentid]);
     return result.length === 0;
   } catch (error) {
     logger.error(error);
     throw new Error(error);
    }
  }


  async newDepartmentRequisition(records) {
    try {
      const { stockid, departmentid, quantity, comsumptionunit, employeeid } = records;

      const isNotEmptyFields = Object.values(records).filter((field) => {
        return field === "" || field === null;
      });
    
      if (isNotEmptyFields.length > 0) return customError({ message: 'all fields are required', statusCode: 404, response }); 
    
      if (!(await this.canRequestNew(stockid, departmentid))) return 'requisition already made and unresolved';
  
      const sql_query = `INSERT INTO departmentrequisition
      (stockid, departmentid, quantity_requested, comsumptionunit,requestingemployee)
      VALUES (?,?,?,?,?)`;
  
      const values = [stockid, departmentid, quantity, comsumptionunit, employeeid];

      const result = await promisifyQuery(sql_query, values);
      
      return rowAffected(result) ? 'requisition successful' : 'requisition failed';
    } catch (err) {
      logger.error(err);
      throw new Error(err);
     }
  }

  async getDepartmentsRequisitions(queryset ={count: 10,page:1}) {
    const query = ` SELECT * FROM departmentrequisition ORDER BY id ASC LIMIT ? OFFSET`;
    return paginationQuery(queryset, query);
  }

  async getDeptStocks(departmentid) {
    const query = `
              SELECT np.stockid,np.name,ds.quantityAvailable,sc.category,np.consumptionunit
              FROM generalstocks
                        AS np INNER JOIN departmentstocks AS
                        ds ON np.stockid = ds.stockid INNER 
                        JOIN departments AS d ON d.id = ds.deptid 
              INNER JOIN stockcategory AS sc On sc.id = np.category
              WHERE ds.deptid = ? 
    `;

    if (!this.departmentid || !departmentid) {
      return new Error('departmentid required');
    } 

    return await promisifyQuery(query, [this.departmentid || departmentid]);
  }


  async deleteDeptStocks(departmentid, employeeid) {
    if (!departmentid || !employeeid) return new Error("departmentid and employeeid required");

    const role = await new User().getUserRole(employeeid);
    
    if (!role) return 'user not recognized';

    if (role != 'admin' || role != 'manager') {
      return 'user do not have permission to delete stocks';
    }

    const mysql_query = `DELETE FROM departmentstocks WHERE stockid = ?`;

    return rowAffected(await promisifyQuery(mysql_query, [departmentid]));
  }

  async deleteUnAttendedRequistions() {
   
 }
}


module.exports = Requisition;
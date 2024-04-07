const { response, query } = require("express");
const { customError, promisifyQuery, rowAffected, responseError, paginationQuery } = require("../../../helper");
const logger = require("../../../logger");
const User = require("../../LobnosAuth/user");

class Expenses {
      constructor(employeeid, branchid) {
            this.employeeid = employeeid;
            this.branchid = branchid;
      }

      isExpenseApproved(expenseid) {

      }
      getAdminRequest(branchid) {

      }

      getRequest() {
            if (!this.employeeid || this.branchid) {
                  throw new Error('branchid or employeeid not provided');
            }

      }

      async generateNewExpense(data, response) {
            try {
                  if (Object.keys(data).length == 0 || typeof data != 'object') {
                        throw new TypeError('object with keys required');
                  }
                  const { employeeid, branchid, name, date, merchant, amount, mode, description, category } = data;

                  if (!employeeid || !branchid || !name) {
                        return customError('name, employeeid, branchid required', 404, response);
                  }
                  if (category == 0 || !category) return customError('category id not provided', 404, response);
                  const query = `INSERT INTO expensesrecord (name,amount,mode,employeeid,branchid,description,merchant,category,date) VALUES(?,?,?,?,?,?,?,?,?)`;
                  let inserted = await promisifyQuery(query, [name, amount, mode, employeeid, branchid, description, merchant, category, date]);

                  inserted = rowAffected(inserted);
                  response.send({ status: inserted ? 'success' : 'failed' })
            } catch (err) {
                  logger.error(err?.message)
            }
      }


      async getExpensesRecord(employeeid, branchid, status, pageQuery = { count: 10, page: 1 }) {
            const record = await new User().userExistWithId(employeeid);
            let role = undefined;
            let query = `SELECT 
                  er.name,
                  er.description,
                  er.merchant,
                  r.username,
                  er.approved,
                  er.date,
                  er.createdon,
                  er.id,
                  er.employeeid,
                  er.amount
             FROM expensesrecord AS er INNER JOIN roles AS r ON r.employeeid = er.employeeid`;
            let values = [];
            if (record.length > 0) {
                  role = record[0]['role'];
            }
            if (!['admin', 'manager'].includes(role)) {
                  query += ` WHERE er.employeeid = ? AND er.branchid =?`;
                  values = [employeeid, branchid]
            } else {
                  query += ` WHERE er.employeeid = ?`;
                  values = [employeeid]
            }

            if (status && status == "approved") {
                  query += ` AND er.approved = 1`;
            } else if (status && status == 'unapproved') {
                  query += ` AND er.approved = 2`;
            } else if (status && status == "request") {
                  query += ` AND er.approved = 0`;
            } else {
                  query = query;
            }
            query += ` LIMIT ? OFFSET ?`;
            return await paginationQuery(pageQuery, query, values);
      }
}



module.exports = Expenses;

const connection = require('../db');
const { testTable } = require('./result')
class Manager {
 constructor(employeeid, billingid) {
  this.employeeid = employeeid;
  this.billingid = billingid;
 }


 getManagerApprovals = (duration) => {
    let defaultDuration = 'daily';

    
 }

 verificationManager([resultset], key) {
  if (!Array.isArray(resultset)) {
   return new Error('')
  }

  // filter for manager name and employee id 

  const isFound = resultset.filter((i, ix) => i?.[key] === key)

  return isFound;
 }

 insertApproval = async (testname, _approvalstatus, message) => {
  const insertNewResult = `UPDATE ${testTable[testname]} SET APPROVAL = ? ,
  MESSAGE = ${_approvalstatus == true ? 'TRUE' : message},
  APPROVALDATE = NOW() WHERE BILLINGID = ? 
 `

  const values = [_approvalstatus, this.billingid]

  return new Promise((reject, resolve) => {
   connection.query(insertNewResult, values, (err, result) => {
    if (err) { reject(err); connection.end() };
    if (result && result.affectedRows > 0) {
     reject(result)
    }
   })
  })
 }


 async approveResult(testname, testid, _approvalstatus,message=null) {
  if (testname && testid) {
   throw new Error('testname and testid required')
  }

  if (testname && testid) {
   const affected = await this.insertApproval(testname, _approvalstatus,message)
   return parseInt(affected) > 0 ? 'success' : 'failure'
  }
 }
}
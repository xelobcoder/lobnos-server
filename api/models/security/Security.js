const { readFile } = require("node:fs/promises")
const jwt = require("jsonwebtoken");
const { promisifyQuery, rowAffected } = require("../../../helper");

class Security {
          constructor(employeeid, loginDuration) {
                    this.employeeid = employeeid
                    this.loginDuration = loginDuration || 3;
                    this.sqlConnection = promisifyQuery;
          }

          isEmployeeid() {
                    return this.employeeid != null || this.employeeid != undefined;
          }
          getClientInformation(request) { }

          async createSessionId() {
                    return jwt.sign(this.employeeid, process.env.ACCESS_TOKEN_SECRET);
          }

          validDurationProvided() {
                    return this.loginDuration && this.loginDuration > 0 && this.loginDuration <= 6;
          }

          async insertLoginHistory(browserInformation) {
                    const expirtyTime = Date.now() + this.loginDuration * 60 * 60 * 1000;
                    if (!this.employeeid) {
                              throw new Error("employeeid not provided");
                    }
                    if (!this.validDurationProvided()) {
                              throw new Error('login Duration must be between 7 && 0');
                    }
                    let sessionid = await this.createSessionId();
                    const query = `INSERT INTO loginlogs (employeeid,loginSessionId,logoutTime,browserInformation) 
                    VALUES(?,?,?,?)`;
                    const values = [this.employeeid, sessionid, expirtyTime, JSON.stringify(browserInformation)];
                    const result = await this.sqlConnection(query, values);
                    return result;
          }

          currentTimeInMillessconds = () => { return Date.now() }

          async getCurrentLoginCounts() {
                    const query = `SELECT COUNT(*) AS count FROM loginlogs WHERE logoutTime > ?`;
                    const result = await this.sqlConnection(query, this.currentTimeInMillessconds());
                    return result.length > 0 ? result[0]['count'] : 0
          }

          async getCurrentUserLoginSessions() {
                    if (this.isEmployeeid()) {
                              const sessionQuery = `SELECT * FROM sessionTracker WHERE logoutTime > ? AND employeeid = ?`;
                              const data = await this.sqlConnection(sessionQuery, [this.currentTimeInMillessconds(), this.employeeid]);
                              return data;
                    }
                    return null
          }

          async getCurrentUserLoginSessionsWithDetails() {
                    if (this.isEmployeeid()) {
                              const sessionQuery = `SELECT * FROM sessionTracker AS st
                              INNER JOIN loginLogs AS ll ON ll.employeeid = st.employeeid WHERE st.logoutTime > ? AND st.employeeid = ? AND ll.loggedout = 0`
                              let data = await this.sqlConnection(sessionQuery, [this.currentTimeInMillessconds(), this.employeeid]);
                              if (data.length > 0) {
                                        return data = data.map((item, index) => {
                                                  if (item.hasOwnProperty("browserInformation")) {
                                                            item['browserInformation'] = JSON.parse(item['browserInformation']);
                                                  }
                                                  return item
                                        })
                              }
                    }
                    return [];
          }

          async getCanInitiateLogin() {
                    const data = await this.getCurrentUserLoginSessions();
                    if (Array.isArray(data)) return data.length == 0;
          }

          async destroyUserSessions() {
                    let sessionsKeys = [];
                    try {
                              const query = `SELECT * FROM sessionTracker WHERE employeeid = ?`;
                              let result = await this.sqlConnection(query, this.employeeid);
                              if (result.length > 0) {
                                        result = result.map((item, index) => sessionsKeys.push(item?.loginhxid));
                                        return await  this.sqlConnection(`DELETE FROM sessionTracker WHERE employeeid = ?`, [this.employeeid]);
                              }

                    } catch (err) {
                              console.log(err)
                    } finally {
                              if (sessionsKeys.length > 0) {
                                        sessionsKeys.map(async (item, index) => {
                                                  const query = `UPDATE loginlogs SET loggedout = 1 WHERE keyid = ?`;
                                                  const updated = await this.sqlConnection(query, [item])
                                                  return rowAffected(updated)
                                        })
                                        let status = (await Promise.all(sessionsKeys)).some((a, i) => a == false);

                                        return status ? false : true;
                              }
                    }
          }
}

module.exports = Security

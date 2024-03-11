const { convertKeysToLowerCase, promisifyQuery, customError, rowAffected } = require("../../helper")
const logger = require("../../logger")
const connection = require("../db")
const { allFieldsHasValues } = require("./categories")
const testpanel = {
  listquery: `SELECT 
      tp.name,
      tp.id,
      tp.price,
      tp.created_on,
      tp.description,
      s.name AS sample,
      tp.sample_container,
      tp.unit,
      tp.qty_required,
      d.department AS category
    FROM test_panels AS tp
      INNER JOIN departments AS d ON d.id = tp.category
      INNER JOIN sampletype AS s ON s.id = tp.sample`,
  listqueryid: function (action, id) {
    return `${action} FROM test_panels WHERE ID = ${id}`
  },
  hasquery: function (request) {
    return Object.keys(request.query).length > 0 ? true : false
  },
  updatequery: function (id, price, category) {
    return `UPDATE test_panels SET price = ${price}, category = ${category} WHERE id = ${id}`
  },
  postquery: function (name, price, category) {
    return `INSERT INTO test_panels (NAME,CATEGORY,PRICE) VALUES ('${name}','${category}','${price}')`
  },
  panelExist: function (name) {
    return new Promise((resolve, reject) => {
      let query = `SELECT NAME FROM test_panels WHERE NAME = '${name}'`
      connection.query(query, (err, result) => {
        if (err) {
          reject(err)
        }
        if (result) {
          if (result.length > 0) {
            resolve(true)
          } else {
            resolve(false)
          }
        }
      })
    })
  },
  getPanels: async function (request, response) {
    try {
      if (this.hasquery(request)) {
        const { id } = request.query
        const result = await promisifyQuery(this.listqueryid("SELECT *", id))
        response.send({ statusCode: 200, status: "success", message: "success", data: result })
      } else {
        const result = await promisifyQuery(this.listquery)
        response.send({ statusCode: 200, status: "success", message: "success", data: result })
      }
    } catch (err) {
      logger.error(err)
    }
  },
  updatePanel: function (request, response) {
    const { id, price, category } = request.query
    // check if all fields are present
    if (id && price && category) {
      // check if all fields have values
      if (allFieldsHasValues(request.body)) {
        connection.query(testpanel.updatequery(id, price, category), (err, result) => {
          if (err) {
            logger.error(err)
          }
          if (result) {
            response.send({
              message: "Panel updated successfully",
            })
          }
        })
      } else {
        response.send({
          message: "All fields must have values",
        })
      }
    }
  },
  deletePanel: async function (testid) {
    if (!testid || isNaN(testid)) throw new Error("testid not provided")
    const iscustomQuery = `SELECT iscustom,name FROM test_panels WHERE id = ?`
    const result = await promisifyQuery(iscustomQuery, [parseInt(testid)])
    if (result.length === 0) return false
    let isCustom = result[0]["iscustom"]
    if (isCustom === 0) return false
    const isdeleted = rowAffected(await promisifyQuery(`DELETE FROM test_panels WHERE id = ? AND iscustom = 1`, [parseInt(testid)]))
    if (isdeleted) {
      const testname = result[0]["name"].toString().replaceAll(" ", "_")
      const dropTableQ = `DROP TABLE result${testname}`
      await promisifyQuery(dropTableQ)
      return true
    }
  },
  postPanel: async function (request, response) {
    // check if all fields are present
    const isFieldsOkay =
      Object.values(request.body).filter((value) => value == "" || value == null || value == undefined || value == 0).length > 0
        ? false
        : true

    if (isFieldsOkay) {
      request.body.samplevolume = parseInt(request.body.samplevolume)
      const { test, price, category, unit, sample, samplevolume, samplecontainer, description } = request.body
      // check if panel already exist
      let panelExist = await this.panelExist(test)
      if (panelExist) {
        response.send({
          statusCode: 200,
          status: "success",
          message: "Panel already exist",
        })
      } else {
        //we create a query and execute so as to insert panel into database
        const query = `INSERT INTO test_panels (NAME,PRICE,CATEGORY,UNIT,QTY_REQUIRED,SAMPLE_CONTAINER,DESCRIPTION,SAMPLE) VALUES ('${test}','${price}','${category}','${unit}','${samplevolume}','${samplecontainer}','${description}','${sample}')`

        // execute query

        connection.query(query, (err, result) => {
          if (err) {
            response.send({
              statusCode: 500,
              status: "error",
              message: "Internal server error",
            })
          }
          if (result) {
            response.send({
              statusCode: 201,
              status: "success",
              message: "Panel created successfully",
            })
          }
        })
      }
    }
  },

  addSampleType: async function (request, response) {
    const query = `INSERT INTO sampletype (name) VALUE (?)`
    const { name } = request.body
    connection.query(query, [name], (err, result) => {
      if (err) {
        response.send({
          message: "error adding sample type",
          statusCode: 500,
          status: "error",
        })
      }
      if (result) {
        response.send({
          message: "added successfully",
          statusCode: 201,
          status: "success",
        })
      }
    })
  },

  getSampleType: async function (response) {
    connection.query(`SELECT * FROM sampletype`, function (err, result) {
      if (err) {
        response.send({
          message: err.message,
          statusCode: 500,
          status: "error",
        })
      }
      if (result) {
        response.send({
          result,
          statusCode: 200,
          status: "success",
        })
      }
    })
  },
  deleteSampleType: async function (request, response) {
    const { id } = request.query

    if (id) {
      connection.query(`DELETE FROM sampletype WHERE id = ?`, [id], function (err, result) {
        if (err) {
          response.send({
            message: err.message,
            statusCode: 500,
            status: "error",
          })
        } else {
          response.send({
            message: "deleted successfully",
            statusCode: 200,
            status: "success",
          })
        }
      })
    }
  },
  bulkTestUpdate: async function (request, response) {
    const { panel } = request.body
    if (!panel) {
      response.send({ message: "panel required", statusCode: "400", status: "error" })
    } else {
      if (Array.isArray(panel) && panel.length > 0) {
        try {
          panel.forEach(async (item, index) => {
            const { id, name, price, sample, category, qty_required } = item
            const queryString = `UPDATE test_panels SET 
             name = ?,price = ?,sample = ?,category = ?,qty_required = ? WHERE id  = ?`
            const result = await promisifyQuery(queryString, [name, price, sample, category, qty_required, id])
            if (result.affectedRows > 0) {
              if (index === panel.length - 1) {
                response.send({ message: "update successful", statusCode: "201", status: "success" })
              }
            }
          })
        } catch (err) {
          logger.error(err)
          response.send({ message: err.message, statusCode: "500", status: "error" })
        }
      }
    }
  },

  hasTest: async function (testname) {
    if (!testname) throw new Error("testname required")
    const result = await promisifyQuery(`SELECT COUNT(*)AS count FROM test_panels WHERE name = ? `, [testname])
    return result[0]["count"] == 0 ? false : true
  },

  updateProcedureManual: async function (manual, testid, employeeid, title) {
    if (!manual || typeof manual !== "string" || !testid || typeof testid !== "number" || !employeeid) {
      throw new Error("employeeid, manual and testid of string and number type respectively are required")
    }
    const query = `UPDATE proceduremanual SET 
       proceduremanual = ?,
       title = ?,
       updatedon = NOW(),
       createdby  = ? WHERE testid = ?`
    return rowAffected(await promisifyQuery(query, [manual, title, employeeid, testid]))
  },

  getProcedureManuel: async function (testid) {
    if (!testid) return false
    const query = `SELECT * FROM proceduremanual WHERE testid = ?`
    return await promisifyQuery(query, [parseInt(testid)])
  },

  putSingleTestPanel: async function (request, response) {
    const { id } = request.body

    if (!id) return customError(`query id required`, 404, response)
    else {
      const query = `UPDATE test_panels SET
          name = ?,
          price = ?,
          sample_container = ?,
          sample= ?,
          category = ?,
          unit =?,
          description = ?,
          qty_required = ?,
          shorttext = ?
          WHERE id = ?`

      const {
        name,
        category,
        testprice,
        id,
        sample_container,
        unit,
        sample,
        shorttext,
        isoutsourced,
        description,
        qty_required,
        hasManual,
        procedureCode,
        tat,
        pre_Tat,
        post_Tat,
        showtrend,
        hasChildrenLimit,
        hasGenderVariation,
        tatCount,
        employeeid,
        testid,
        testcost,
      } = request.body

      const updateMainPanel = await promisifyQuery(query, [
        name,
        testprice,
        sample_container,
        sample,
        category,
        unit,
        description,
        qty_required,
        shorttext,
        testid,
      ])
      const outcome = rowAffected(updateMainPanel)
      if (outcome) {
        const updatePanel = `
        UPDATE testdetails SET 
                tat  = ?,
                pre_Tat = ?,
                post_Tat = ?,
                hasManual = ?,
                procedureCode = ? ,
                tatCount = ?,
                updatedby = ?,
                updatedon = NOW(),
                isoutsourced = ?,
                showtrend = ?,
                testprice = ?,
                hasChildrenLimit =?,
                hasGenderVariation= ?,
                testcost = ?
        WHERE testid = ?`

        const values = [
          tat,
          pre_Tat,
          post_Tat,
          hasManual,
          procedureCode,
          tatCount,
          employeeid,
          isoutsourced,
          showtrend,
          testprice,
          hasChildrenLimit,
          hasGenderVariation,
          testcost,
          testid,
        ]

        const updateTestDetails = await promisifyQuery(updatePanel, values)

        response.send({ status: rowAffected(updateTestDetails) ? "success" : "failed" })
      }
    }
  },

  getpanelsbulk: async function (request, response) {
    const query = `SELECT * FROM test_panels`

    try {
      let result = await promisifyQuery(query)
      if (result.length > 0) {
        result = result.map((item, index) => {
          return convertKeysToLowerCase({ ...item, sampleid: null })
        })
      }
      response.send({ message: "success", statusCode: 200, status: "success", data: result })
    } catch (err) {
      logger.error(err)
      response.send({ message: err.message, statusCode: 500, status: "error" })
    }
  },

  getPanelEditSingle: async function (testid) {
    const query = `SELECT * FROM test_panels AS tp INNER JOIN testdetails AS td ON td.testid = tp.id
    WHERE tp.id = ?`
    return await promisifyQuery(query, [testid])
  },

  generateTableName: function (testname) {
    if (!testname) return false
    return testname.toString().replaceAll(" ", "_")
  },

  createCustomTest: async function (testname, iscustom = 1) {
    if (!testname) throw new Error("testname required")
    if (this.hasTest(testname) === true) {
      return "EXIST"
    }
    const query = `INSERT INTO test_panels (name,iscustom) VALUES(?,?)`

    const istestcreated = rowAffected(await promisifyQuery(query, [testname, iscustom]))

    if (istestcreated) {
      const createTestTableQuery = `CREATE TABLE result${this.generateTableName(
        testname
      )} (id INT(255) PRIMARY KEY AUTO_INCREMENT,field VARCHAR(100), billingid INT(50), patientid BIGINT(50),value VARCHAR(60),created_on DATETIME(6) DEFAULT CURRENT_TIMESTAMP,updatedon DATETIME(6) DEFAULT  NULL,employeeid INT(10))`

      await promisifyQuery(createTestTableQuery, [testname])
      return istestcreated
    }
  },
}



module.exports = testpanel

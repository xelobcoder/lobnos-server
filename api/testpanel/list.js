const { convertKeysToLowerCase, promisifyQuery } = require('../../helper');
const logger = require('../../logger');
const connection = require('../db');
const { allFieldsHasValues } = require('./categories')
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
    return `${action} FROM test_panels WHERE ID = ${id}`;
  },
  hasquery: function (request) {
    return Object.keys(request.query).length > 0 ? true : false;
  },
  updatequery: function (id, price, category) {
    return `UPDATE test_panels SET price = ${price}, category = ${category} WHERE id = ${id}`;
  },
  postquery: function (name, price, category) {
    return `INSERT INTO test_panels (NAME,CATEGORY,PRICE) VALUES ('${name}','${category}','${price}')`;
  },
  panelExist: function (name) {
    return new Promise((resolve, reject) => {
      let query = `SELECT NAME FROM test_panels WHERE NAME = '${name}'`;
      connection.query(query, (err, result) => {
        if (err) {
          reject(err);
        }
        if (result) {
          if (result.length > 0) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
    });
  },
  getPanels: async function (request, response) {
    try {
      if (this.hasquery(request)) {
        const { id } = request.query;
        const result = await promisifyQuery(this.listqueryid('SELECT *', id));
        response.send({ statusCode: 200, status: 'success', message: 'success', data: result })
      } else {
        const result = await promisifyQuery(this.listquery);
        response.send({ statusCode: 200, status: 'success', message: 'success', data: result })
      }
    } catch (err) {
      logger.error(err);
    }
  },
  updatePanel: function (request, response) {
    const { id, price, category } = request.query;
    // check if all fields are present
    if (id && price && category) {
      // check if all fields have values
      if (allFieldsHasValues(request.body)) {
        connection.query(
          testpanel.updatequery(id, price, category),
          (err, result) => {
            if (err) { logger.error(err) };
            if (result) {
              response.send({
                message: "Panel updated successfully",
              });
            }
          }
        );
      } else {
        response.send({
          message: "All fields must have values",
        });
      }
    }
  },
  deletePanel: async function (request, response) {
    if (this.hasquery(request)) {
      const { id } = request.query;
      connection.query(testpanel.listqueryid("DELETE", id), function (err, result) {
        if (err) {
          response.send({ status: 'error', message: err })
        }
        else {
          const { affectedRows } = result;
          if (affectedRows > 0) {
            response.send({
              message: "Panel deleted successfully",
              status: 'success',
              statusCode: 200
            });
          }
          else {
            response.send({
              message: "Panel not found",
              status: 'warning',
              statusCode: 404
            });
          }
        }
      })
    }
    else {
      response.send({
        message: "Id is required",
        status: 'warning',
        statusCode: 400
      });
    }
  },
  postPanel: async function (request, response) {
    // check if all fields are present
    const isFieldsOkay =
      Object.values(request.body).filter(
        (value) =>
          value == "" || value == null || value == undefined || value == 0
      ).length > 0
        ? false
        : true;

    if (isFieldsOkay) {
      request.body.samplevolume = parseInt(request.body.samplevolume);
      const {
        test,
        price,
        category,
        unit,
        sample,
        samplevolume,
        samplecontainer,
        description,
      } = request.body;
      // check if panel already exist
      let panelExist = await this.panelExist(test);
      if (panelExist) {
        response.send({
          statusCode: 200,
          status: "success",
          message: "Panel already exist",
        });
      } else {
        //we create a query and execute so as to insert panel into database
        const query = `INSERT INTO test_panels (NAME,PRICE,CATEGORY,UNIT,QTY_REQUIRED,SAMPLE_CONTAINER,DESCRIPTION,SAMPLE) VALUES ('${test}','${price}','${category}','${unit}','${samplevolume}','${samplecontainer}','${description}','${sample}')`;

        // execute query

        connection.query(query, (err, result) => {
          if (err) {
            response.send({
              statusCode: 500,
              status: "error",
              message: "Internal server error",
            });
          }
          if (result) {
            response.send({
              statusCode: 201,
              status: "success",
              message: "Panel created successfully",
            });
          }
        });
      }
    }
  },

  addSampleType: async function (request, response) {
    const query = `INSERT INTO sampletype (name) VALUE (?)`;
    const { name } = request.body;
    connection.query(query, [name], (err, result) => {
      if (err) {
        response.send({
          message: 'error adding sample type',
          statusCode: 500,
          status: 'error'
        })
      }
      if (result) {
        response.send({
          message: 'added successfully',
          statusCode: 201,
          status: 'success'
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
          status: 'error'
        })
      }
      if (result) {
        response.send({
          result,
          statusCode: 200,
          status: 'success'
        })
      }
    })
  },
  deleteSampleType: async function (request, response) {
    const { id } = request.query;

    if (id) {
      connection.query(`DELETE FROM sampletype WHERE id = ?`, [id], function (err, result) {
        if (err) {
          response.send({
            message: err.message,
            statusCode: 500,
            status: 'error'
          })
        } else {
          response.send({
            message: 'deleted successfully',
            statusCode: 200,
            status: 'success'
          })
        }
      })
    }
  },
  bulkTestUpdate: async function (request, response) {
    const { panel } = request.body;
    if (!panel) { response.send({ message: 'panel required', statusCode: '400', status: 'error' }) }
    else {
      if (Array.isArray(panel) && panel.length > 0) {
        try {
          panel.forEach(async (item, index) => {
            const { id, name, price, sample, category, qty_required } = item;
            const queryString = `UPDATE test_panels SET 
             name = ?,price = ?,sample = ?,category = ?,qty_required = ? WHERE id  = ?`;
            const result = await promisifyQuery(queryString, [name, price, sample, category, qty_required, id]);
            if (result.affectedRows > 0) {
              if (index === panel.length - 1) {
                response.send({ message: 'update successful', statusCode: '201', status: 'success' })
              }
            }
          })
        } catch (err) {
          logger.error(err);
          response.send({ message: err.message, statusCode: '500', status: 'error' })
        }
      }
    }
  },

  putSingleTestPanel: async function (request, response) {
    const { id } = request.query;
    if (!id) { response.send({ message: 'query id required', statusCode: '400', status: 'error' }) }
    else {
      const query = `UPDATE test_panels SET 
      NAME = ?,
      PRICE = ?,
      SAMPLE_CONTAINER = ?,
      SAMPLE= ?,
      UNIT =?,
      DESCRIPTION=?,
      QTY_REQUIRED = ?
      WHERE ID =?`;

      const { UNIT, PRICE, SAMPLE_CONTAINER, DESCRIPTION, QTY_REQUIRED, SAMPLE, NAME } = request.body.panel;

      const values = [NAME, PRICE, SAMPLE_CONTAINER, SAMPLE, UNIT, DESCRIPTION, QTY_REQUIRED, id]
      connection.query(query, values, function (err, result) {
        if (err) {
          response.send({ message: err.message, statusCode: '400', status: 'error' })
        } else {
          response.send({
            message: 'update successful',
            statusCode: 201,
            status: 'success'
          })
        }
      })
    }
  },

  getpanelsbulk: async function (request, response) {
    const query = `SELECT * FROM test_panels`;

    try {
      let result = await promisifyQuery(query);
      if (result.length > 0) { result = result.map((item, index) => { return convertKeysToLowerCase({ ...item, sampleid: null }) }) }
      response.send({ message: 'success', statusCode: 200, status: 'success', data: result })
    } catch (err) {
      logger.error(err);
      response.send({ message: err.message, statusCode: 500, status: 'error' })
    }
  }
};

module.exports = testpanel;

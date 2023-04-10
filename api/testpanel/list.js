const connection = require('../db');
const { allFieldsHasValues } = require('./categories')
const testpanel = {
  listquery: "SELECT * FROM test_panels",
  listqueryid: function (action, id) {
    return `${action}  FROM test_panels WHERE ID = ${id}`;
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
  getPanels: function (request, response) {
    connection.query(this.listquery, (err, result) => {
      if (err) throw err;
      response.send({
        statusCode: 200,
        status: "success",
        message: "Panels retrieved successfully",
        data: result,
      });
    });
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
            if (err) throw err;
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
};

module.exports = testpanel;

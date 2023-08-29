const connection = require("../db");

function resetDatabaseToDefault() {
  let errorCount = [];
  const getallTables = `SHOW TABLES`;

  connection.query(getallTables, function (err, result) {
    if (err) {
      throw err.message;
    }

    // list of tables that should not be truncated
    const requiredTables = ['test_panels', 'applicationsettings', 'sampletypes']

    const truncateTable = function (name) {
      connection.query(`TRUNCATE TABLE ${name}`, (err, result) => {
        if (err) { errorCount.push(err.message); }
        return;
      })
    }

    if (result.length > 0) {
      const dbNames = result.map((item, index) => {
        return item.Tables_in_limsdb
      })

      dbNames.forEach((item, index) => {
        if (requiredTables.includes(item)) {
          return
        } else {
          truncateTable(item)
        }

        if (index + 1 == dbNames.length) {
          return true;
        }
      })

    }
  })

  return true
}


function addDefaults(response) {
  const modes = ['momo', 'cheque', 'bank transfer', 'cash', 'invoice']
  const query = `INSERT INTO paymentmodes(paymentMode) VALUES (?)`;

  modes.forEach((item, index) => {
    connection.query(query, item, (err, result) => {
      if (err) {
        if (err.errno == 1062) {
          return;
        }
      }
      if (response) {
        response.send({
          message: 'default payment modes added',
          statusCode: 200,
          status: 'success'
        })
      }
    })
  })





}






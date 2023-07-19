const connection = require('./db')

const activation = {
  ACTIVATION_PAGE_QUERY: `
  SELECT ID, PATIENTID,
  CASE 
    WHEN MIDDLENAME IS NULL THEN CONCAT(FIRSTNAME, ' ', LASTNAME)
    ELSE CONCAT(FIRSTNAME, ' ', MIDDLENAME, ' ', LASTNAME)
  END AS FULLNAME,
  DATE, ACTIVATION_STATUS
FROM new_patients
ORDER BY DATE DESC
LIMIT 100;
             `,
  // get partial data of patients
  getPartialData: function (request, response) {
    connection.query(this.ACTIVATION_PAGE_QUERY, (err, result) => {
      if (err) {
        throw err;
      }
      response.send(result);
    });
  },
  activateDeactivate: function (request, response) {
    const { patientid, action } = request.query;
    if (patientid && action) {
      connection.query(
        `UPDATE new_patients SET ACTIVATION_STATUS = ? WHERE PATIENTID = ?`,
        [action, patientid],
        (err, result) => {
          if (err) {
            response.status(404).send({
              statusCode: 404,
              message: err.message,
            });
          }
          response.send({
            message: "success",
            action: action === "TRUE" ? "BILLING" : "ACTIVATION PAGE",
          });
        }
      );
    }
  },
};


module.exports = activation

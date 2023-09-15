const logger = require('../../logger');
const connection = require('../db');


let o = {};

o.getOrganizations = (req, res) => {
  let query = 'SELECT ID,NAME FROM organization';
  // execute query
  connection.query(query, (err, result) => {
    if (err) {
      logger.error(err)
    }
    res.send({ statusCode: 200, result })
  })
}


o.getOrganizationWithDetails = async function (request, response) {
  connection.query(`SELECT * FROM organization`, function (err, result) {
    if (err) {
      logger.error(err);
    } else {
      response.send({
        statusCode: 200,
        status: 'success',
        result: result
      })
    }
  })
}


o.isOrgnizationExist = function (name) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(NAME) AS NUMBER FROM organization WHERE NAME = ?`;
    connection.query(query, name, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result[0]['NUMBER'] > 0 ? true : false);
      }
    })
  })
}


o.createAOrganization = async function (request, response) {

  const {
    commission,
    momo,
    bankName,
    accountName,
    branch,
    account,
    person,
    email,
    contactPerson,
    contactEmail,
    name,
    location,
    street,
    mobile,
    address,
    website,
    module,
    gpsMapping,
    region,
    district
  } = request.body;

  const query = `INSERT INTO organization 
  (NAME,LOCATION,STREETNAME,MOBILENUMBER,ADDRESS,WEBSITE,
  EMAIL,CONTACTPERSON,CONTACTNUMBER,CONTACTEMAIL,
  ACCOUNTNUMBER,BRANCH,ACCOUNTNAME,BANKNAME,
  MOMO,COMMISSION,GPSMAPPING,PAYMENTMODULE,REGION,DISTRICT)
  VALUE (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;


  const values = [
    name,
    location,
    street,
    mobile,
    address,
    website,
    email,
    person,
    contactPerson,
    contactEmail,
    account,
    branch,
    accountName,
    bankName,
    momo,
    commission,
    gpsMapping,
    module,
    region,
    district
  ];

  const available = await (this.isOrgnizationExist(name));
  if (available) {
    response.send({
      statusCode: 201,
      status: 'exist', message: "Please such organization exists"
    })
  } else {
    connection.query(query, values, function (err, result) {
      if (err) {
        logger.error(err);
      }
      if (result) {
        result.affectedRows == 1 ?
          response.send({
            statusCode: 201,
            organizationId: result.insertId,
            status: 'success',
            message: "new organization created successfully"
          }) :
          response.send({ statusCode: 401, message: 'No insertion done' })
      }
    })
  }
}


o.updateOrganization = async function (request, response) {
  const {
    id,
    commission,
    momo,
    bankName,
    accountName,
    branch,
    account,
    person,
    email,
    contactPerson,
    contactEmail,
    name,
    location,
    street,
    mobile,
    address,
    website,
    module,
    gpsMapping,
    region,
    district
  } = request.query;

  const query = `UPDATE organization SET 
  NAME = ?,
  LOCATION = ?,
  STREETNAME = ?,
  MOBILENUMBER = ?,
  ADDRESS = ?,
  WEBSITE = ?,
  EMAIL = ?,
  CONTACTPERSON = ?,
  CONTACTNUMBER = ?,
  CONTACTEMAIL = ?,
  ACCOUNTNUMBER = ?,
  BRANCH = ?,
  ACCOUNTNAME = ?,
  BANKNAME = ?,
  MOMO = ?,
  COMMISSION = ?,
  GPSMAPPING = ?,
  PAYMENTMODULE = ?,
  REGION = ?,
  DISTRICT = ?
   WHERE ID = ?`;


  const values = [
    name,
    location,
    street,
    mobile,
    address,
    website,
    email,
    person,
    contactPerson,
    contactEmail,
    account,
    branch,
    accountName,
    bankName,
    momo,
    commission,
    gpsMapping,
    module,
    region,
    district,
    id
  ];

  connection.query(query, values, function (err, result) {
    if (err) {
      logger.error(err);
    }
    if (result) {
      result.affectedRows == 1 ?
        response.send({ statusCode: 201, message: "organization updated successfully" }) :
        response.send({ statusCode: 401, message: 'No update done' })
    }
  }
  )
}


o.deleteOrganization = async function (request, response) {
  const { id } = request.query;
  const query = `DELETE FROM organization WHERE ID = ?`;
  connection.query(query, id, function (err, result) {
    if (err) {
      logger.error(err);
    }
    if (result) {
      result.affectedRows == 1 ?
        response.send({ statusCode: 201, message: "organization deleted successfully" }) :
        response.send({ statusCode: 401, message: 'No deletion done' })
    }
  })
}

o.getOrganizationId = async function (request, response) {
  const id = request.query.id;
  const query = `SELECT * FROM organization WHERE ID = ?`;
  connection.query(query, id, function (err, result) {
    if (err) {
      logger.error(err);
    }
    if (result) {
      // converting keys to camel case

      const data = JSON.parse(JSON.stringify(result[0]).toLowerCase());
      response.send({ statusCode: 201, data: data })
    }
  })
}

o.getOrganizationCommissionByMonth = async function (request, response) {
  const { id } = request.query;
  const query = `SELECT PAID_AMOUNT FROM billing WHERE organization = ?`;

}


o.dailyOrganizationCommission = async function (request, response) {
  const { id } = request.query;

  const query = `SELECT 
        SUM(b.PAID_AMOUNT) AS COMMISION,
        DAY(pt.DATE) AS DAY
        FROM billing AS b INNER JOIN performing_test
        AS pt ON b.BILLINGID = pt.BILLINGID 
        WHERE b.ORGANIZATION = ${id} AND MONTH(pt.DATE) = MONTH(NOW())
          AND YEAR(NOW()) = YEAR(pt.DATE)
        GROUP BY DAY(pt.DATE) ORDER BY DAY(pt.DATE) ASC`
    ;

  connection.query(query, function (err, result) {
    if (err) {
      logger.error(err);
    }
    if (result) {
      response.send(result)
    }
  }
  )

}

o.getOrganizationCommissionByMonth = async function (request, response) {
  const { id } = request.query;

  const query = `SELECT
        SUM(b.PAID_AMOUNT) AS COMMISION,
        MONTH(pt.DATE) AS MONTH
        FROM billing AS b INNER JOIN performing_test
        AS pt ON b.BILLINGID = pt.BILLINGID
        WHERE b.ORGANIZATION = ${id} AND YEAR(pt.DATE) = YEAR(NOW())
        GROUP BY MONTH(pt.DATE) ORDER BY MONTH(pt.DATE) ASC`
    ;

  connection.query(query, function (err, result) {

    if (err) {
      logger.error(err);
    }
    if (result) {
      response.send(result)
    }
  }
  )
}



o.getTopPerformance = async function (request, response) {
  const { count } = request.query;

  if (!count) {
    response.send({
      message: 'count represent top count required',
      statusCode: 401,
      status: 'warning'
    })
  } else {
    let query_string = `
       SELECT DISTINCT o.ID AS id,
          o.NAME AS name,
          o.COMMISSION AS commissionRate,
          o.COMMISSION / 100 * (
            SELECT SUM(b.PAYABLE)
            WHERE o.ID = o.ID
          ) AS commissionEarned,
          SUM(b.payable) AS TotalSales
        FROM ORGANIZATION AS o
          INNER JOIN BILLING AS b ON b.ORGANIZATION = o.ID
        GROUP BY o.ID,
          o.NAME
        ORDER BY TotalSales DESC 
      `;

    query_string += ` LIMIT ${count}`


    connection.query(query_string, function (err, result) {
      if (err) {
        response.send({
          message: err.message,
          statusCode: 500,
          status: 'error'
        })
      } else {
        response.send({
          result,
          statusCode: 200,
          status: 'success'
        })
      }
    })
  }
}


module.exports = o;

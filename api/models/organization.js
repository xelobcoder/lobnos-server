const connection = require('../db');


let o = {};

o.getOrganizations = (req, res) => {
  let query = 'SELECT ID,NAME FROM organization';
  // execute query
  connection.query(query, (err, result) => {
    if (err) {
      throw err
    }
    res.send(result)
  })
}


o.getOrganizationWithDetails = async function (request, response) {
  connection.query(`SELECT * FROM ORGANIZATION`, function (err, result) {
    if (err) {
      throw err;
    } else {
      response.send({
        statusCode: 200,
        status: 'success',
        records: result
      })
    }
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

  const query = `INSERT INTO ORGANIZATION 
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
    parseInt(account),
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

  connection.query(query, values, function (err, result) {
    if (err) {
      throw err;
    }
    if (result) {
      response.send(result)
    }
  })
}




module.exports = o;
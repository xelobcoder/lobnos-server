const connection = require("../db");
const User = require("../LobnosAuth/user");
const jwt = require("jsonwebtoken");

const createNewAccount = async (req, res) => {
  const { name, password, role, email } = req.body;

  if (name == '' || password == '' || role == '', email == '') {
    res.send({
      status: 400,
      message: 'Bad Request'
    })
  }

  else {
    // cinstanitate user class
    const user = new User(name, password, role, email);


    user.checkUserExist()
      .then((exist) => {
        if (!exist) {
          user.hashPassword()
            .then((hashedPassword) => {
              user.insertionOne(name, hashedPassword)
                .then((result) => {
                  res.send({ status: 'success', message: 'user created successfully' })
                })
                .catch((err) => {
                  res.send({ status: 'error', message: err })
                })

            })
            .catch((err) => {
              res.send({ status: 'error', message: err })
            })
        }
        else {
          res.send({ status: 'error', message: 'user already exist' })
        }
      })
      .catch((err) => {
        res.send({ status: 'error', message: err })
      })
  }
}



const userLogin = async (req, res, secret) => {
  const { name, password, email } = req.body;

  //  check if user and password exist in db
  const user = new User(name, password);

  const userExist = await user.checkLogins(email, password);

  if (userExist) {
    let userinformation = await user.createAccessTokenCredentials(secret);
    // decode userinformation
    let decoded = jwt.verify(userinformation, process.env.ACCESS_TOKEN_SECRET)
    res.send({
      status: 'success',
      statusCode: 200,
      message: 'Login successful',
      user: userinformation,
      decoded
    })

  }
  else {
    res.send({
      status: 'error',
      statusCode: 400,
      message: 'Invalid Login credentials',
    })
  }
}



const getAllLogins = async (req, res) => {
  // create a wql query to get all logins
  const queryString = `SELECT * FROM roles ORDER BY EMPLOYEEID DESC LIMIT 20;
`;

  // execute query
  connection.query(queryString, (err, result) => {
    if (err) {
      console.log(err)
      res.status(400).send({
        statusCode: 301,
        message: 'error occured'
      })
    }
    else {
      res.status(200).send({
        statusCode: 200,
        message: 'success',
        result
      })
    }
  })

}


const deleteAccount = async (req, res) => {
  const { id } = req.body;
  if (id == '') {
    res.send({
      status: 400,
      message: 'Bad Request'
    })
  }
  else {
    // delete account
    const queryString = `DELETE FROM roles WHERE EMPLOYEEID = '${id}'`;
    // execute query
    connection.query(queryString, (err, result) => {
      if (err) {
        res.status(400).send({
          statusCode: 301,
          message: 'error occured'
        })
      }
      else {
        res.status(200).send({
          statusCode: 200,
          status: 'success',
          message: result.affectedRows + ' row(s) deleted'
        })
      }
    }
    )
  }
}

const getAUser = async (req, res) => {
  // using query string , get id from request and query db
  const { id } = req.query;
  // execute query
  const queryString = `SELECT USERNAME,EMAIL,EMPLOYEEID,ROLE FROM roles WHERE EMPLOYEEID = '${id}'`;
  connection.query(queryString, (err, result) => {
    if (err) {
      res.status(400).send({
        statusCode: 301,
        message: 'error occured'
      })
    }
    else {
      res.status(200).send({
        statusCode: 200,
        message: 'success',
        result
      })
    }
  })
}

const updateUserBasicInfo = async (req, res) => {
  const { employeeid, name, email, password, role } = req.body;
  if (!employeeid) {
    res.status(200).send({
      statusCode: 401,
      message: 'employeeid not included',
      status: 'error'
    })
  }
  else {
    const mtquery = `UPDATE ROLES 
            SET USERNAME = ?,EMAIL = ? ,
            PASSWORD = ? , ROLE = ? 
            WHERE EMPLOYEEID = ? `;
    // execute mtquery
    connection.query(mtquery, [name, email, password, role, employeeid], function (err, result) {
      if (err) {
        throw err;
      }
      else {
        res.status(200).send({
          statusCode: 200,
          message: result.affectedRows > 0 ? 'record updated successfully' : 'record not updated',
          status: 'success'
        })
      }
    })
  }
}

const activateAUser = async function (request, response) {
  const { id, currentv } = request.body;
  if (id == '') {
    response.send({
      status: 400,
      message: 'Bad Request'
    })
  }
  else {
    const queryString = `UPDATE roles SET ACTIVATION = ? WHERE EMPLOYEEID = ?`;
    // execute query
    connection.query(queryString, [currentv, id], (err, result) => {
      if (err) {
        response.status(400).send({
          statusCode: 301,
          message: 'error occured'
        })
      }
      else {
        response.status(200).send({
          statusCode: 200,
          status: 'success',
          message: result.affectedRows > 0 ? 'record updated successfully' : 'record not updated'
        })
      }
    });
  }
}




const getPermissions = async (permissions, response) => {
  const userClass = new User();
  const user = await userClass.userExistWithId(permissions);
  if (user) {
    const { ROLE } = user[0];
    // get role table
    const getRoleTab = userClass.permissionsByRole(ROLE);
    connection.query(
      `SELECT * FROM ${getRoleTab} WHERE EMPLOYEEID = ${permissions}`,
      function (err, result) {
        if (err) {
          throw err;
        } else {
          if (result.length > 0) {
            // format the result 
            const resultObject = result[0];
            const keyValues = function () {
              let obj = {};
              Object.entries(resultObject).map(
                (item, index) => {
                  const [key, value] = item;
                  obj[key] = value == 0 ? false : value == 1 ? true : value;
                  // if pageAccess, we want to remove all \ and  we convert to an object
                  if (key == 'pageAccess') {
                    const removeBackSlash = obj[key].replace(/\\/g, '');
                    obj[key] = JSON.parse(removeBackSlash);
                  }
                }
              )
              return obj;
            }
            // add the role 
            const returner = keyValues()
            returner['role'] = ROLE;
            returner['name'] = user[0]['USERNAME']
            response.send(returner)
          } else {
            response.send([])
          }
        }
      }
    );
  }
}


const updateUserPermission = async (request, response) => {
  const { pageAccess, role } = request.body;
  console.log(request.body)
  // destrcutre the body based on the role
  // convert pageAccess to an JSON object
  const pageAccessObject = JSON.stringify(pageAccess);
  if (role == 'customer service representative') {
    const { deletev, editv, registerv, viewv, printv, activatev, employeeid } = request.body;
    // we update the customerrepresentativepermission table
    const queryString = `UPDATE customerrepresentativepermission
    SET DELETEV = ?,EDITV = ?,REGISTERV = ?,VIEWV = ?,PRINTV = ?,ACTIVATEV = ?,PAGEACCESS = ?
    WHERE EMPLOYEEID = ?`;

    // execute query
    connection.query(queryString, [deletev, editv, registerv, viewv, printv, activatev, pageAccessObject, employeeid], (err, result) => {
      if (err) {
        throw err;
      }
      else {
        response.send({
          statusCode: 200,
          message: result.affectedRows > 0 ? 'record updated successfully' : 'record not updated',
          status: 'success'
        })
      }
    })
  } else if (role == 'scientist') {
    const { deletev, editv, registerv, viewv, printv, activatev, employeeid, viewresult, printresult, enterresult, editresult, deleteresult } = request.body;
    // create a scientistpermission table, columns must be in lowercase 
    // boolean values and pageaccess must be a json object
    const queryString = `UPDATE scientistpermission
    SET DELETEV = ?,EDITV = ?,REGISTERV = ?,VIEWV = ?,PRINTV = ?,ACTIVATEV = ?,PAGEACCESS = ?,
    VIEWRESULT = ?,PRINTRESULT = ?,ENTERRESULT = ?,EDITRESULT = ?,DELETERESULT = ?
    WHERE EMPLOYEEID = ?`;

    // execute query
    connection.query(queryString, [deletev, editv, registerv, viewv, printv, activatev, pageAccessObject, viewresult, printresult, enterresult, editresult, deleteresult, employeeid], (err, result) => {
      if (err) {
        throw err;
      }
      else {
        response.send({
          statusCode: 200,
          message: result.affectedRows > 0 ? 'record updated successfully' : 'record not updated',
          status: 'success'
        })
      }
    })
  } else {
    return response.send({
      statusCode: 401,
      message: 'invalid role',
      status: 'error'
    })
  }
}


module.exports = {
  createNewAccount, getAllLogins, userLogin, getAUser,
  updateUserBasicInfo,
  deleteAccount, activateAUser,
  getPermissions,
  updateUserPermission
}
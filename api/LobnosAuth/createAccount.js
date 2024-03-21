const connection = require("../db");
const User = require("../LobnosAuth/user");
const jwt = require("jsonwebtoken");
const { customError, convertKeysToLowerCase, promisifyQuery, paginationQuery, responseError } = require("../../helper")
const logger = require("../../logger")
const { del } = require("../database/queries")

const createNewAccount = async (req, res) => {
  const { name, password, role, email } = req.body
  if ((name == "" || password == "" || role == "", email == "")) {
    customError(400, "Bad Request Request", res)
    return
  }
  // instanitate user class
  const user = new User(name, password, role, email)
  const isUser = await user.checkUserExist()
  if (Array.isArray(isUser) && isUser.length === 0) {
    try {
      const hashedPassword = await user.hashPassword()
      const insert = await user.insertionOne(name, hashedPassword)
      if (insert) res.send({ status: "success", message: "user created successfully" })
    } catch (err) {
      res.send({ status: "error", message: err })
      logger.error(err)
    }
  } else {
    res.send({ status: "error", message: "user already exist" })
  }
}

/**
 * Handles the login process for a user.
 * Checks if the provided username and password exist in the database.
 * If the login credentials are valid, it generates an access token for the user,
 * sets it as a cookie, and sends a success response.
 * If the login credentials are invalid, it sends an error response.
 *
 * @param {Object} req - The request object containing the user's login information.
 * @param {Object} res - The response object used to send the login response.
 * @returns {void}
 */
const userLogin = async (req, response) => {
  const { name, password, email } = req.body
  //  check if user and password exist in db
  const user = new User(name, password)
  const userExist = await user.checkLogins(email, password)
  if (!userExist) {
    return customError("Invalid Login credentials", 400, res)
  }
  let userinformation = await user.getUserData(email)
  if (userinformation) {
    const user_needed_data = await user.processUserData(userinformation);
    const token = await user.createAccessTokenCredentials(process.env.ACCESS_TOKEN_SECRET, email, user_needed_data, "1h")
    response.send({
      status: "success",
      statusCode: 200,
      message: "Login successful",
      user: user_needed_data,
      token,
    })
  } else {
    return customError(`user not found`, 404, response)
  }
}

/**
 * Retrieves all login information from the "roles" table and sends the result as a response to the client.
 *
 * @param {Object} req - The request object containing information about the HTTP request.
 * @param {Object} res - The response object used to send the HTTP response.
 * @returns {void}
 */

const getAllLogins = async (req, res) => {
  try {
    const query = `
    SELECT
     employeeid,
     username,
     role,
     email,
     emailAuthenticated,
     activation
    FROM roles ORDER BY EMPLOYEEID DESC LIMIT ? OFFSET ?
    `
    const result = await paginationQuery(req.query, query)
    res.send({ status: "success", result, statusCode: 200 })
  } catch (err) {
    customError("somethin wrong occured", 301, res)
    logger.error(err)
  }
}

const deleteAccount = async (req, res) => {
  /**
   * Deletes an account from the database.
   *
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {void}
   */
  const { id } = req.body
  if (id == "") {
    res.send({
      status: 400,
      message: "Bad Request",
    })
  } else {
    // delete account
    const queryString = `DELETE FROM roles WHERE EMPLOYEEID = '${id}'`
    // execute query
    connection.query(queryString, (err, result) => {
      if (err) {
        res.status(400).send({
          statusCode: 301,
          message: "error occured",
        })
      } else {
        res.status(200).send({
          statusCode: 200,
          status: "success",
          message: result.affectedRows + " row(s) deleted",
        })
      }
    })
  }
}

const getAUser = async (req, res) => {
  try {
    // using query string , get id from request and query db
    const { id } = req.query
    if (!id) {
      return customError("employeeid required", 404, res)
    }
    // execute query
    const queryString = `SELECT username,email,employeeid,role FROM roles WHERE employeeid = ?`

    const result = await promisifyQuery(queryString, [parseInt(id)])
    res.send({ result, message: "success", statusCode: 200 })
  } catch (err) {
    logger.error(err)
    responseError(res)
  }
}

/**
 * Updates the basic information of a user in the database.
 * If the employeeid is not included in the request body, it sends an error response.
 * Otherwise, it hashes the password using the User class, constructs an SQL query to update the user's information,
 * and executes the query using the connection object. Finally, it sends a success response with the appropriate message
 * based on the result of the query.
 *
 * @param {Object} req - The request object containing the user's information to be updated.
 * @param {Object} res - The response object used to send the result of the update operation.
 * @returns {Promise<void>} - A promise that resolves when the update operation is complete.
 */
const updateUserBasicInfo = async (req, res) => {
  const { employeeid, name, email, password, role } = req.body

  if (!employeeid) {
    res.status(401).send({
      statusCode: 401,
      message: "employeeid not included",
      status: "error",
    })
    return
  }

  try {
    const hashedPassword = await new User(name, password, role, email).hashPassword()
    const mtquery = `UPDATE ROLES 
            SET USERNAME = ?,EMAIL = ? ,
            PASSWORD = ? , ROLE = ? 
            WHERE EMPLOYEEID = ?`

    connection.query(mtquery, [name, email, hashedPassword, role, employeeid], function (err, result) {
      if (err) {
        logger.error(err)
      } else {
        const message = result.affectedRows > 0 ? "record updated successfully" : "record not updated"
        res.status(200).send({
          statusCode: 200,
          message: message,
          status: "success",
        })
      }
    })
  } catch (error) {
    console.log(error)
    logger.error(error)
  }
}

const activateAUser = async function (request, response) {
  const { id, currentv } = request.body
  if (id == "") {
    response.send({
      status: 400,
      message: "Bad Request",
    })
  } else {
    const queryString = `UPDATE roles SET ACTIVATION = ? WHERE EMPLOYEEID = ?`
    // execute query
    connection.query(queryString, [currentv, id], (err, result) => {
      if (err) {
        response.status(400).send({
          statusCode: 301,
          message: "error occured",
        })
      } else {
        response.status(200).send({
          statusCode: 200,
          status: "success",
          message: result.affectedRows > 0 ? "record updated successfully" : "record not updated",
        })
      }
    })
  }
}

const getPermissions = async (permissions, response) => {
  const userClass = new User()
  const user = await userClass.userExistWithId(permissions)
  if (!user) throw new Error("User does not exist")
  const userData = user[0]
  let obj = {}
  for (const [key, value] of Object.entries(userData)) {
    if (key == "permissions") {
      if (value !== "{}") obj[key.toLowerCase()] = JSON.parse(value)
      if (value === null || value === undefined) obj[key.toLowerCase()] = {}
    }
  }
  return obj
}

const updateUserPermission = async function (request, response) {
  const { id } = request.query;
  const permissions = request.body;

  const queryString = `UPDATE roles SET PERMISSIONS = ? WHERE EMPLOYEEID = ?`;

  connection.query(queryString, [JSON.stringify(permissions), parseInt(id)], function (err, result) {
    if (err) {
      customError(err.message, 500, response)
    } else {
      sendResponse(response, 'updated successfully', 'success')
    }
  })
}




function sendResponse(response, message, status, statusCode = 200) {
  response.send({
    statusCode: statusCode,
    message: message,
    status: status
  });
}


module.exports = {
  createNewAccount,
  getAllLogins,
  userLogin,
  getAUser,
  updateUserBasicInfo,
  deleteAccount,
  activateAUser,
  getPermissions,
  updateUserPermission
};


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
          message : result.affectedRows + ' row(s) deleted'
        })
      }
    }
    )
  }
}


const updateUserBasicInfo = async (req, res) => {
  const { id, name, email, password, role } = req.body;
}

const activateAUser = async function (request, response) {

}


module.exports = {
  createNewAccount, getAllLogins, userLogin, updateUserBasicInfo,
  deleteAccount, activateAUser
}
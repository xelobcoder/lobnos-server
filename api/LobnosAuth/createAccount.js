const connection = require("../db");
const User = require("../LobnosAuth/user");
const jwt = require("jsonwebtoken");

const createNewAccount = async (req, res) => {
  const { username, password, role } = req.body;

  if (username == '' || password == '' || role == '') {
    res.send({
      status: 400,
      message: 'Bad Request'
    })
  }

  else {
    // cinstanitate user class
    const user = new User(username, password, role);


    user.checkUserExist()
      .then((exist) => {
        if (!exist) {
          user.hashPassword()
            .then((hashedPassword) => {
              user.insertionOne(user.username, hashedPassword)
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
  const { username, password } = req.body;

  //  check if user and password exist in db
  const user = new User(username, password);

  const userExist = await user.checkLogins(username, password);

  if (userExist) {
    let userinformation = await user.createAccessTokenCredentials(secret);
    // decode userinformation
    let decoded = jwt.verify(userinformation,process.env.ACCESS_TOKEN_SECRET)
    res.send({
      status: 'success',
      statusCode: 200,
      message: 'Login successful',
      user : userinformation,
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
  const queryString = `SELECT * FROM roles`;

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


module.exports = { createNewAccount, getAllLogins, userLogin }
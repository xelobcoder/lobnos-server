const bcrypt = require("bcrypt");
const connection = require("../db");
const { response, request } = require("express");
const jwt = require("jsonwebtoken");




class User {
  constructor(username, password, role, request, response) {
    this.username = username;
    this.password = password;
    this.role = role;
  }

  checkUserExist() {
    return new Promise((resolve, reject) => {
      connection.query(
        `SELECT * FROM roles WHERE username = '${this.username}'`,
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            if (result.length > 0) {
              resolve(true);
            } else {
              resolve(false);
            }
          }
        }
      );
    });
  }

  hashPassword = async () => {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return this.password;
  };

  insertionOne = async (username, password) => {
    return new Promise((resolve, reject) => {
      const queryString = `INSERT INTO ROLES(USERNAME,PASSWORD,ROLE) VALUES('${username}','${password}','${this.role}')`;
      connection.query(queryString, (err, result) => {
        err ? reject(err) : resolve(result);
      });
    });
  };

  getUserData = async (username) => {
    return new Promise((resolve, reject) => {
      const queryString = `SELECT * FROM ROLES WHERE USERNAME = '${username}'`;

      connection.query(queryString, (err, result) => {
        err ? reject(err) : resolve(result);
      });
    });
  };

  createUser = async () => {
    return new Promise((resolve, reject) => {
      this.checkUserExist()
        .then((userexist) => {
          if (userexist) {
            resolve("user already exist");
          } else {
            // insert the user into the database
            this.hashPassword()
              .then((hashedPassword) => {
                this.insertionOne(this.username, hashedPassword)
                  .then((result) => {
                    resolve(result);
                  })
                  .catch((err) => {
                    reject(err);
                  });
              })
              .catch((err) => {
                console.log(err);
              });
          }
        })
        .catch((err) => {
          console.log(err);
        });
    });
  };

  checkLogins = async (username, password) => {
    return new Promise((resolve, reject) => {
      this.hashPassword(password)
        .then((hashedPassword) => {
          const queryString = `SELECT * FROM ROLES WHERE USERNAME = '${username}'`;
          connection.query(queryString, (err, result) => {
            if (err) {
              reject(err);
            }
            if (result.length === 0) {
              resolve(false);
            }
            if (result.length > 0) {
              const rpass = result[0]["PASSWORD"];
              bcrypt.compare(password, rpass, (err, result) => {
                err ? reject(err) : resolve(result);
              });
            }
          });
        })
        .catch((err) => {
          console.log(err);
        });
    });
  };

  createAccessTokenCredentials = async (accesskey) => {
    const user = this.username;
    const pass = this.password;

    let accessToken;
    return new Promise((resolve, reject) => {
      this.getUserData(user)
        .then((result) => {
          const role = result[0]["ROLE"];
           accessToken = jwt.sign({ user, pass, role }, accesskey, {
            expiresIn: "1w",
          });
          resolve(accessToken);
        })
        .catch((err) => {
          reject(err);
        });
    });
  };


  validateRequestToken = async (req, res, next, accessSecret) => {
    // CHECK FOR ACCESS TOKEN IN AUTHORIZATION HEADER OF REQUEST bearer token
    const accessToken = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!accessToken) {
      res.send({
        status: 401,
        message: 'Unauthorized'
      })
    }
    else {
      jwt.verify(accessToken, accessSecret, (err, user) => {
        err ? res.send({ err }) : next();
      }
      )
    }
  }
}


module.exports = User;
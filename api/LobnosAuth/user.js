const bcrypt = require("bcrypt");
const connection = require("../db");
const jwt = require("jsonwebtoken");
const env = require('node:process');




class User {
  constructor(name, password, role, email) {
    this.name = name;
    this.password = password;
    this.role = role;
    this.email = email;
  }

  checkUserExist() {
    return new Promise((resolve, reject) => {
      connection.query(
        `SELECT * FROM roles WHERE email = '${this.email}'`,
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

  insertionOne = async (name, password) => {
    return new Promise((resolve, reject) => {
      const queryString = `INSERT INTO ROLES (USERNAME,PASSWORD,ROLE,EMAIL) 
      VALUES('${name}','${password}','${this.role}','${this.email}')`;
      connection.query(queryString, (err, result) => {
        err ? reject(err) : resolve(result);
      });
    });
  };

  getUserData = async (email) => {
    return new Promise((resolve, reject) => {
      const queryString = `SELECT * FROM ROLES WHERE EMAIL = '${email}'`;
      connection.query(queryString, (err, result) => {
        // if result return with a length of 0 then user does not exist
        if (result.length == 0) {
          resolve(false);
        }
        // if result return with a length of 1 then user exist
        else {
          //  we get the empoyeeid and the role of the user
          const { EMPLOYEEID, USERNAME, ROLE } = result[0];
          // we search for the using their empoyeeid in thr role table
          const roleTables = {
            customer: 'customerrepresentativepermission',
            scientist: 'scientistpermission',
            admin: 'adminmanagerpermission'
          }
          // we search for the using their empoyeeid in thr role table
          const queryString = `SELECT * FROM ${roleTables[ROLE]} WHERE EMPLOYEEID = '${EMPLOYEEID}'`;
          // execute the query
          connection.query(queryString, (err, result) => {
            if (err) {
              reject(err)
            }
            else {
              if (result.length > 0) {
                resolve({ ...result[0], EMPLOYEEID, ROLE, USERNAME });
              } else {
                resolve(false);
              }
            }
          });
        }
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
                this.insertionOne(this.name, hashedPassword)
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

  checkLogins = (email, password) => {
    return new Promise((resolve, reject) => {
      this.hashPassword(password)
        .then((hashedPassword) => {
          const queryString = `SELECT * FROM ROLES WHERE EMAIL = '${email}'`;
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

  createAccessTokenCredentials = async (accesskey, email) => {
    let accessToken;
    return new Promise((resolve, reject) => {
      this.getUserData(email)
        .then((result) => {
          accessToken = jwt.sign({ ...result }, accesskey, {
            expiresIn: "4d",
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


  userExistWithId = async (id) => {
    const promise = new Promise((resolve, reject) => {
      const gq = `SELECT * FROM ROLES WHERE EMPLOYEEID = ${id}`

      connection.query(gq, (err, result) => {
        if (err) { reject(err) }
        else {
          const len = result.length;
          if (len == 0) { resolve(false) } else { resolve(result) }
        }
      })
    })
    return promise;
  }


  permissionsByRole = function (role) {
    if (role === 'customer service representative') {
      return 'customerrepresentativepermission'
    } else if (role == 'scientist') {
      return 'scientistpermission'
    } else {
      return 'adminmanagerpermission'
    }
  }

}

// const  u1 = new User('tiifu','tiifu','admin').createAccessTokenCredentials(
//  'jaffhfyufqsufasfyst'
// )

// console.log(process.env.ACCESS_TOKEN_SECRET)
// console.log(u1.then((t) => console.log(t)))

module.exports = User;
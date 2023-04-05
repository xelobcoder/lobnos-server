const bcrypt = require("bcrypt");
const connection = require("../db");
const dotenv = require("dotenv");
const { response, request } = require("express");
const jwt = require("jsonwebtoken");

dotenv.config();

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
    })
  }

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
            if (result.length === 0) { resolve(false) }
            if (result.length > 0) {
              const rpass = result[0]['PASSWORD'];
              bcrypt.compare(password, rpass, (err, result) => {
                err ? reject(err) : resolve(result)
              })
            }
          });
        })
        .catch((err) => {
          console.log(err);
        });
    });
  };

  createAccessTokenCredentials = async (username, password) => {
    const user = this.username || username;
    const pass = this.password || password;

    let accessToken;
    const access_secret = process.env.ACCESS_TOKEN_SECRET || "access_secret";
    return new Promise((resolve, reject) => {

      this.checkLogins(user, pass)
        .then((result) => {
          if (result) {
            this.getUserData(user)
              .then((result) => {
                const payload = { username: user, role: result[0]['ROLE'] };
                accessToken = jwt.sign(payload, access_secret, { expiresIn: '1h' });
                resolve(accessToken);
              })
              .catch((err) => {
                reject(err);
              });
          }
        })
        .catch((err) => {
          reject(err);
        });

    })
  };

}

const user = new User("Tiifu Hamza", "admin", "Lab Technician");

user.createAccessTokenCredentials("Tiifu Hamza", "admin")
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });
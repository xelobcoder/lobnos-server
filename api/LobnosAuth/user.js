const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logger = require("../../logger");
const { convertKeysToLowerCase, promisifyQuery, customError } = require("../../helper");






class User {
  constructor(name, password, role, email) {
    this.name = name;
    this.password = password;
    this.role = role;
    this.email = email;
  }


  checkUserExist() {
    return promisifyQuery(`SELECT * FROM roles WHERE email`, this.email)
  }

  hashPassword = async () => {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return this.password;
  };

  isPasswordSame = async (password, hashpassword)  => {
    return await bcrypt.compare(password,hashpassword);
  }
  insertionOne = async (name, password) => {
    return promisifyQuery(`INSERT INTO roles (USERNAME,PASSWORD,ROLE,EMAIL) 
      VALUES (?,?,?,?)`,[name,password,this.role,this.email])
  };

  getUserData = async (email) => {
    try {
      const queryString = `SELECT * FROM roles WHERE EMAIL = ?`;
      const result = await promisifyQuery(queryString, email);
      if (result.length === 0) return false;
      const data = result[0];
       return data;
    } catch (err) {
      logger.error(err);
      return false;
   }
  };

  createUser = async () => {
    try {
      const isUserExist = await this.checkUserExist();
      if (isUserExist) return "user already exist";
      const hashPassword = await this.hashPassword();
      return await this.insertionOne(this.name, hashPassword);
    } catch (err) {
      logger.error(err);
      throw new Error(err?.message || "error creating user");
   }
  };

  checkLogins = async (email, password) => {
    const queryString = `SELECT password FROM roles WHERE EMAIL = ?`;
    try {
      const storedPassword = await promisifyQuery(queryString, email);
      if (storedPassword.length === 0) return false;
      return await bcrypt.compare(password, storedPassword[0]?.password);
    } catch (err) {
      logger.error(err);
      throw new Error(err?.message || "something went wrong");
    }
  };

  createAccessTokenCredentials = async (accesskey, email) => {
    try {
      const result = await this.getUserData(email);
      const accessToken = jwt.sign({ ...result }, accesskey, { expiresIn: "1y" });
      return accessToken;
    } catch (err) {
      logger.error(err);
      throw new Error(err?.message || "something went wrong");
     }
  };


  validateRequestToken = async (req, res, next, accessSecret) => {
    // CHECK FOR ACCESS TOKEN IN AUTHORIZATION HEADER OF REQUEST bearer token
    const accessToken = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!accessToken) { customError('Unauthorized to acesss service.', 401, res); return };
    const cb = (err, user) => { 
      if (err) { customError("Application licenced expired, please contact admin for renewal", 401, res); return }
      next();
    }
     await this.verifyToken(accessToken,process.env.ACCESS_TOKEN_SECRET,cb);
  }

  validateEmployeeToken = async function (request, response) {
    try {
      const {token } = request.query;
      if (!token) { customError("token not provided", 404, response); return; }
      const tokenvalid = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
       tokenvalid && response.send({ statusCode: 200, status: 'success', user: convertKeysToLowerCase(tokenvalid) });
    } catch (err) {
      customError(err?.message || 'Expired token', 404, response);
   }
  }

  verifyToken = async (token) => {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  }

  tokenizeData = async (data,expiresIn) => {
    return jwt.sign({ ...data }, process.env.ACCESS_TOKEN_SECRET, { expiresIn })
  }


  userExistWithId = async (id) => {
   try
   {
      const query = `SELECT * FROM roles WHERE EMPLOYEEID = ?`;
      const result = await promisifyQuery(query, id);
      return result.length === 0 ? false : result;
    }
    catch
   (err) {
     logger.error(err);
     throw new Error(err?.message || "something went wrong");
    }
  }
}


module.exports = User;
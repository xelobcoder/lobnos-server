const connectionpool = require('./api/dbpool');
const { PatientQueries } = require('./helpers/testtables');
const logger = require('./logger');
function customError(message, statusCode, response) {
  if (!response) {
    throw new TypeError("Http response object required");
  }
  response.send({ message: message || "something wrong occured", statusCode: statusCode || 500, status: 'error' });
}
function responseError(response) {
  response.send({ message: "something wrong occured", statusCode:  500, status: 'error' });
}


const removeHtmlTags = (string) => {
   const removeTags = (string, starter, ended) => {
     const _stringArray = string.trim().split("")
     let start = 0
     let end = 0

     for (let i = 0; i < _stringArray.length; i++) {
       if (_stringArray[i] === starter) {
         start = i
       }

       if (_stringArray[i] === ended) {
         end = i
         break
       }
     }

     const umatched = _stringArray.map((item, index) => {
       if (!(index >= start && index <= end)) return item
     })

     const result = umatched.join("")

     if (umatched.includes(starter) || umatched.includes(ended)) {
       return removeHtmlTags(result)
     }
     return result.toLowerCase()
   }
  //  const st1 = removeTags(string, "<", ">")
  // return st1.split("&nbsp;").join("").split("&nbs").join("");
  return string
}

function convertKeysToLowerCase(obj) {
  if (typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Input must be an object")
  }
  const result = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key.toLowerCase()] = obj[key]
    }
  }
  return result
}


function NotFound(response) {
  response.send({ message: 'Data not found', status: 'error' });
}

async function promisifyQuery(query, values = []) {
  return new Promise((resolve, reject) => {
    connectionpool.getConnection((getConnectionError, connection) => {
      if (getConnectionError) {
        reject(getConnectionError)
        return
      }

      connection.query(query, values, (queryError, result) => {
        connection.release()

        if (queryError) {
          reject(queryError)
        } else {
          resolve(result)
        }
      })
    })
  })
}

async function retryableTransaction(fn, maxRetries = 3, delayBetweenRetries = 1000) {
  let retries = 0;

  async function attempt() {
    try {
      await fn();
    } catch (error) {
      if (error.code === 'ER_LOCK_WAIT_TIMEOUT' && retries < maxRetries) {
        retries++;
        console.warn(`Lock wait timeout, retrying (${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenRetries));
        return attempt();
      } else {
        throw error;
      }
    }
  }

  await attempt();
}


async function paginationQuery(pageQuery, query, values) {
  let useQuery = {count: pageQuery?.count || 10, page:  pageQuery?.page || 1}
  const { count, page } = useQuery;
  const pageSize = parseInt(count);
  const currentPage = (parseInt(page)) - 1;
  const offset = currentPage * pageSize;
  let newValues = [pageSize, offset];
  if (values && values.length > 0) newValues = [...values, ...newValues];
  return await promisifyQuery(query, newValues);
}

const getFullBloodCountTrend = async (patientid) => {
  const getClientGenderPacket = await promisifyQuery(`SELECT gender,age,agetype FROM new_patients WHERE patientid = ?`, patientid);

  const gender = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['gender'] : null;
 
  const age = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['age'] : null;
  const agetype = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['agetype'] : null;

  let trendDataSet = await promisifyQuery(PatientQueries.getFbcTrend(gender, age, agetype), [patientid]);

  trendDataSet = trendDataSet.length > 0 ? trendDataSet.map((item) => { return convertKeysToLowerCase(item); }) : [];

  return trendDataSet;
}


const rowAffected = (result) => {
  return result.affectedRows > 0 ? true : false;
 }

module.exports = {
  customError,
  convertKeysToLowerCase,
  getFullBloodCountTrend,
  responseError,
  promisifyQuery,
  NotFound,
  removeHtmlTags,
  paginationQuery,
  rowAffected,
  retryableTransaction
}
const connectionpool = require('./api/dbpool');
const { PatientQueries } = require('./helpers/testtables');
function customError(message, statusCode, response) {
  if (!response) {
    throw new Error('response required'); 
  }
  response.send({message,statusCode,status: 'error'})
}


function convertKeysToLowerCase(obj) {
  if (typeof obj !== 'object' || Array.isArray(obj)) {throw new Error('Input must be an object');
  }
  const result = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key.toLowerCase()] = obj[key];
    }
  }

  return result;
}


async function promisifyQuery(query, values) {
  return new Promise((resolve, reject) => {
    connectionpool.query(query, values, function (err, result) {
      if (err) {
        reject(err)
      }
      else {
        resolve(result)
      }
    })
  })

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
  promisifyQuery,
  paginationQuery,
  rowAffected
}
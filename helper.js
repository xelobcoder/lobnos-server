const connectionpool = require('./api/dbpool');
const { PatientQueries } = require('./helpers/testtables');
function customError(message, statusCode, response) {
  if (response) {
    response.send({
      message,
      statusCode,
      status: 'error'
    })
  }
  return;
}


function convertKeysToLowerCase(obj) {
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('Input must be an object');
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

const getFullBloodCountTrend = async (patientid) => {
  const getClientGenderPacket = await promisifyQuery(`SELECT gender,age,agetype FROM new_patients WHERE patientid = ?`, patientid);

  const gender = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['gender'] : null;
  const age = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['age'] : null;
  const agetype = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['agetype'] : null;

  let trendDataSet = await promisifyQuery(PatientQueries.getFbcTrend(gender, age, agetype), [patientid]);

  trendDataSet = trendDataSet.length > 0 ? trendDataSet.map((item) => { return convertKeysToLowerCase(item); }) : [];

  return trendDataSet;
}

module.exports = {
  customError,
  convertKeysToLowerCase,
  getFullBloodCountTrend,
  promisifyQuery
}
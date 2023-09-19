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




module.exports = {
  customError,
  convertKeysToLowerCase
}
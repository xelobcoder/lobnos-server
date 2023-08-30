const { response } = require("express");

function customError(message, statusCode) {
  response.send({
    message,
    statusCode,
    status: 'error'
  })
}





module.exports = {
  customError
}
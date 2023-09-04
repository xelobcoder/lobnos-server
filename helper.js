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





module.exports = {
  customError
}
const { createNewAccount, getAllLogins, userLogin } = require('../LobnosAuth/createAccount')
const router = require('express').Router();
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;


router.get('/api/v1/logins', async (request, response) => {
   getAllLogins(request, response)
})

router.post('/api/v1/logins', async (request, response) => {
   createNewAccount(request, response)
})


router.post('/api/v1/authenticate', async (request, response) => {
   const { username, password } = request.body

   if (username == '' || password == '') {
      response.send({
         statusCode: 400,
         message: 'Bad Request',
      })
   }
   else {
      userLogin(request, response, ACCESS_TOKEN_SECRET)
   }
})


module.exports = router;
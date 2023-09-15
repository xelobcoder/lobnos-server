const { createNewAccount, getAllLogins, userLogin, deleteAccount, updateUserPermission,
   getPermissions,
   activateAUser, getAUser, updateUserBasicInfo } = require('../LobnosAuth/createAccount')
const router = require('express').Router();



router.get('/api/v1/logins', async (request, response) => {
   const queryLen = Object.keys(request.query).length
   if (queryLen == 0) {
      getAllLogins(request, response)
   }
   else {
      getAUser(request, response)
   }
})

router.post('/api/v1/logins', async (request, response) => {
   createNewAccount(request, response)
})

router.delete('/api/v1/logins', async (request, response) => {
   deleteAccount(request, response)
})


router.post('/api/v1/logins/update', async (request, response) => {
   updateUserBasicInfo(request, response)
})

router.post('/api/v1/authenticate', async (request, response) => {
   const { email, password } = request.body
   console.log(request.body)

   if (!email || !password) {
      response.send({
         statusCode: 400,
         message: 'Bad Request',
      })
   }
   else {
      userLogin(request, response)
   }
})


router.put('/api/v1/user/authentication/activate', async (request, response) => {
   activateAUser(request, response)
})



router.get('/api/v1/user/permissions', async function (request, response) {
   const { permissions } = request.query;
   if (permissions) {
      let result = await getPermissions(permissions, response);
      response.send(result)
   } else {
      response.send({
         message: 'employeeid permission id required',
         statusCode: 401
      })
   }
})


router.put('/api/v1/user/permissions', function (request, response) {
   updateUserPermission(request, response);
})


module.exports = router;
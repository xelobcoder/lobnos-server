import express from 'express'
import Manager from '../models/manager/manager'
const router = express.Router();



router.get('/api/v1/manager/approvalist', function(request,response) {
   new Manager().getReadyForApprovals(request,response)
})

export default router
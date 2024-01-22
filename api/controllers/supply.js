const router = require('express').Router();
const Supply = require("../models/supply/supplyclass.js");

const {
  newdepartmentRequisition,
  getDepartmentsRequisitions,
  specificDepartmentRequisition,
  getDeptStocks,
  deleteDeptStocks,
  getDepartmentStockLot,
  patchRequisition,
  updateRequisitionAfterReceivedDept,
  generalStoreLotNo,
  consumeDepartmentStock
} = require('../models/departmentRequisition.js')


const { placeOrder, getOrders, deleteAspecificOrder, purchaseOrdersToStock } = require('../models/placeorders.js');
const { getCategory } = require('../testpanel/categories.js');
const { customError, responseError, NotFound } = require('../../helper.js');
const logger = require('../../logger.js');
const Inventory = require('../models/Inventory/inventoryclass.js');
const Departments = require('../models/Departments/DepartmentClass.js');

router.get('/api/v1/suppliers', async function (request, response) {
  try {
    const result = await new Supply().getSuppliers(request.query);
    response.send({ result, statusCode: 200, status: 'success' });
  } catch (err) {
    customError("something went wrong", 500, response);
    logger.err(err);
  }
})

router.post('/api/v1/suppliers', async function (request, response) {
  try {
    const result = await new Supply().addSupplier(request.body);
    response.send({ message: result ? 'supplier added successfully' : 'supplier addition failed', statusCode: 200, status: "success" });
  } catch (err) {
    customError("something went wrong", 500, response);
   }
})

router.delete('/api/v1/suppliers', async function (request, response) {
  try {
    const { id } = request.query;
    const isdeleted = await new Supply().deleteSupplier(id);
    response.send({ statusCode: 200, status: 'success', message: isdeleted ? "deleted successfully" : 'deleting supplier failed' });
  } catch (err) {
    logger.error(err);
    customError("something went wrong", 500, response);
 }
})

router.put('/api/v1/suppliers', async function (request, response) {
  try {
    const isUpdated = await new Supply().updateSupplier(request.body);

    if (isUpdated === false) { customError("supplier id not provided", 404, response); return; }

    response.send({
      message: isUpdated != null ? "Supplier information updated successfully" : 'Failure in updating supplier', statusCode: 200, 
      status: isUpdated !=  null ? "success" : "error"
  })
  } catch (err) { customError("something wrong occured", 500, response)}
})

router.post('/api/v1/commodities', async function (request, response) {
  try {
    const added = await new Supply().postCommodity(request.body);
    response.send({
      message: added != null ? "new commodity added successfully " : "Failure in adding category", statusCode: 200,
      status: added != null ? "success" : "error"
    })
  } catch (err) { customError(err || "something went wrong", err === "name and category required" ? 404 : 500, response); }
})

router.get('/api/v1/commodities', function (request, response) {
  getCommodity(request, response)
})






router.post('/api/v1/orders', function (request, response) {
  placeOrder(request, response)
})


router.get('/api/v1/orders', function (request, response) {
  getOrders(request, response)
})
router.delete('/api/v1/orders', function (request, response) {
  const { productordersid } = request.body
  deleteAspecificOrder(productordersid, response)
})


router.post('/api/v1/purchases', async function (request, response) {
  try
  {
    const { data, tax, totalprice } = request.body;
     await new Inventory().receivePurchaseStocks(data, totalprice, tax, response);
  } catch (err) {
    customError("something wrong occured",500,response)
  }
})


// apis for department requisitions


router.post('/api/v1/departments/requisitions', function (request, response) {
  newdepartmentRequisition(request, response)
})



router.get('/api/v1/departments/requisitions', async function (request, response) {
  const hasQuery = Object.keys(request.query).length > 0
  if (!hasQuery) {
    getDepartmentsRequisitions(request, response)
  } else {
    const result = await specificDepartmentRequisition(request, response);
    response.send({result, statusCode: 200, status: 'success'})
  }
})


router.get('/api/v1/store/departments/requisitions/serve', async function (request, response) {
  const { departmentid } = request.query;
  if (!departmentid) {
    customError('departmentid not provided', 404, response); return;
  }
  const data = await new Departments(departmentid).StoreServeDeptReq();
  response.send({statusCode: 200,status:'success', result: data});
})


router.post('/api/v1/store/departments/requisitions/serve', async function (request, response) {
  try
  {
    const { data,qtyApproved,requisitionid} = request.body
    if (!data || !qtyApproved ||  !requisitionid) {
      NotFound(response)
      return
    }
    if (!Array.isArray(data) || data.length === 0) {
      customError("data must be an array and must be greater than 0", 404, response)
      return;
    }
    
    const result = await new Departments().serveApprovedReqt(data, qtyApproved, requisitionid);
    
    switch (result) {
      case 'PASSED':
        response.send({ status: 'success' });
        break;
    
      case 'FAILED':
        response.send({ status: 'failed', message: 'stock not added to esrow. You might have omitted something' });
        break;
    
      case 'MISMATCH':
        response.send({ message: 'qty approved and served qty do not match', status: 'failed' });
        break;
    
      case 'ALREADY SUPPLIED':
        response.send({ message: 'ALREADY SUPPLIED', status: 'failed' });
        break;
    
      default:
        response.send({ status: 'pending' });
    }
    
  }
  catch (err) {
    responseError(response);
  }
})


router.get('/api/v1/store/departments/requisitions', async function (request, response) {
  const hasQuery = Object.keys(request.query).length > 0
  if (!hasQuery) {
    getDepartmentsRequisitions(request, response)
  } else {
    const { id } = request.query;
    if (!id) { return customError('departmentid required in query', 404, response);}
    const deptReq = await new Departments(id).getDeptSpecificReqData(id, 'pending');
    response.send({result:deptReq, statusCode: 200, status: 'success'})
  }
})

router.get('/api/v1/departments/requisitions/summary', async function (request, response) {
  try {
    const result = await new Departments().getPendingdepartmentReqSummary();
    response.send({ statusCode: 200, result, status: 'success' });
  } catch (err) {
    console.log(err)
    responseError(response);
   }
})


router.get('/api/v1/departments/stocks', function (request, response) {
  const { id } = request.query;
  getDeptStocks(request, response, id)
})



router.delete('/api/v1/departments/stocks', function (request, response) {
  const { id } = request.query;
  deleteDeptStocks(request, response, id)
})



router.patch('/api/v1/departments/requisitions/stage1', async function (request, response) {
  try
  {
    const { status, quantity, requisitionid } = request.body;
    const isUpdated = await new Departments().updateRequisitionApproval(quantity, requisitionid, status);
    response.send({ status: isUpdated ? 'success' : 'failed'});
  } catch (err) {
    console.log(err)
    customError(err,404,response)
  }
})

router.patch('/api/v1/departments/requisitions/stage2', function (request, response) {
  const { id } = request.query;
  console.log(id,request.body)
  patchRequisition(request, response, id)
})


router.put('/api/v1/departments/requisitions', function (request, response) {
  updateRequisitionAfterReceivedDept(request, response)
})


// consume 
router.get('/api/v1/stock/department/consume/lot', function (request, response) {
  getDepartmentStockLot(request, response);
})


router.get('/api/v1/stock/general/lotno', function (request, response) {
  generalStoreLotNo(request, response);
})


router.post('/api/v1/departments/stock/consume', async function (request, response) {
  consumeDepartmentStock(request, response);
})

module.exports = router

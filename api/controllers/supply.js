const router = require('express').Router();
const Supply = require("../models/supply.js");
const {
  new_supplier,
  get_suppliers,
  update_supplier,
  delete_supplier,
  specificSupllier,
  postCommodity,
  getCommodity,
  getExpiredStock,
  new_stock,
  getAstock,
  getStock,
  getInStockProduct,
  deleteAstock,
  updateAstock,
  filterStock,
  addNewStockCategory,
  getStockCategory,
  deleteStockCategory

} = require('../models/supply.js')


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
const { customError } = require('../../helper.js');

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
    response.send({ message: result ? 'stock added successfully' : 'stock addition failed', statusCode: 200, status: "success" });
  } catch (err) {
    customError("something went wrong", 500, response);
   }
})

router.delete('/api/v1/suppliers', function (request, response) {
  delete_supplier(request, response)
})

router.put('/api/v1/suppliers', function (request, response) {
  update_supplier(request, response)
})

router.post('/api/v1/commodities', function (request, response) {
  postCommodity(request, response)
})

router.get('/api/v1/commodities', function (request, response) {
  getCommodity(request, response)
})

router.post('/api/v1/stock', function (request, response) {
  new_stock(request, response)
})

router.get('/api/v1/stocks/filter', async function (request, response) {
  const { filter } = request.query;
  if (!filter)
    customError(`filter not included in the request query`, 404, response);
  else {
    filterStock(filter, response)
  }
})

router.get('/api/v1/stock', function (request, response) {
  if (Object.keys(request.query).length === 0) {
    getStock(request, response)
  }
  else {
    const { stockid, expireproduct, instockproduct } = request.query;

    if (expireproduct) {
      getExpiredStock(request, response)
    }
    else if (stockid) {
      getAstock(request, response)
    }
    else if (instockproduct) {
      getInStockProduct(request, response)
        .then((data) => {
          response.status(200).json({
            status: 'success',
            message: 'in stock product fetched successfully',
            data: data
          })
        })
        .catch((error) => {
          console.log(error)
          response.status(500).json({
            status: 'error',
            message: 'in stock product not fetched',
            data: error
          })
        })
    }
    else
      response.send({
        status: 'error',
        message: 'the query is not valid',
      })
  }
})


router.put('/api/v1/stock', function (request, response) {
  updateAstock(request, response)
})

router.post('/api/v1/stock/category', function (request, response) {
  addNewStockCategory(request, response)
})

router.get('/api/v1/stock/category', function (request, response) {
  getStockCategory(request, response)
})

router.delete('/api/v1/stock/category', function (request, response) {
  deleteStockCategory(request, response)
})

router.delete('/api/v1/stock', function (request, response) {
  deleteAstock(request, response);
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


router.post('/api/v1/purchases', function (request, response) {
  purchaseOrdersToStock(request, response)
})


// apis for department requisitions


router.post('/api/v1/departments/requisitions', function (request, response) {
  newdepartmentRequisition(request, response)
})



router.get('/api/v1/departments/requisitions', function (request, response) {
  const hasQuery = Object.keys(request.query).length > 0
  if (!hasQuery) {
    getDepartmentsRequisitions(request, response)
  } else {
    specificDepartmentRequisition(request, response)
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


router.patch('/api/v1/departments/requisitions', function (request, response) {
  const { id } = request.query;
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

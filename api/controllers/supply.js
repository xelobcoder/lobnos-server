const router = require('express').Router();
const Supply = require("../models/supply/supplyclass.js");
const Requisition = require("../models/Inventory/requisitionClass")

const {
  newdepartmentRequisition,
  getDepartmentsRequisitions,
  specificDepartmentRequisition,
  deleteDeptStocks,
  // getDepartmentStockLot,
  patchRequisition,
  updateRequisitionAfterReceivedDept,
  // generalStoreLotNo,
  consumeDepartmentStock,
} = require("../models/departmentRequisition.js")

const { placeOrder, getOrders, deleteAspecificOrder, purchaseOrdersToStock } = require("../models/placeorders.js")
const { getCategory } = require("../testpanel/categories.js")
const { customError, responseError, NotFound } = require("../../helper.js")
const logger = require("../../logger.js")
const Inventory = require("../models/Inventory/inventoryclass.js")
const Departments = require("../models/Departments/DepartmentClass.js")

router.get("/api/v1/suppliers", async function (request, response) {
  try {
    const result = await new Supply().getSuppliers(request.query)
    response.send({ result, statusCode: 200, status: "success" })
  } catch (err) {
    customError("something went wrong", 500, response)
    logger.err(err)
  }
})

router.post("/api/v1/suppliers", async function (request, response) {
  try {
    const result = await new Supply().addSupplier(request.body)
    response.send({ message: result ? "supplier added successfully" : "supplier addition failed", statusCode: 200, status: "success" })
  } catch (err) {
    customError("something went wrong", 500, response)
  }
})

router.delete("/api/v1/suppliers", async function (request, response) {
  try {
    const { id } = request.query
    const isdeleted = await new Supply().deleteSupplier(id)
    response.send({ statusCode: 200, status: "success", message: isdeleted ? "deleted successfully" : "deleting supplier failed" })
  } catch (err) {
    logger.error(err)
    customError("something went wrong", 500, response)
  }
})

router.put("/api/v1/suppliers", async function (request, response) {
  try {
    const isUpdated = await new Supply().updateSupplier(request.body)

    if (isUpdated === false) {
      customError("supplier id not provided", 404, response)
      return
    }

    response.send({
      message: isUpdated != null ? "Supplier information updated successfully" : "Failure in updating supplier",
      statusCode: 200,
      status: isUpdated != null ? "success" : "error",
    })
  } catch (err) {
    customError("something wrong occured", 500, response)
  }
})

router.post("/api/v1/commodities", async function (request, response) {
  try {
    const added = await new Supply().postCommodity(request.body)
    response.send({
      message: added != null ? "new commodity added successfully " : "Failure in adding category",
      statusCode: 200,
      status: added != null ? "success" : "error",
    })
  } catch (err) {
    customError(err || "something went wrong", err === "name and category required" ? 404 : 500, response)
  }
})

router.get("/api/v1/commodities", function (request, response) {
  getCommodity(request, response)
})

router.post("/api/v1/orders", function (request, response) {
  placeOrder(request, response)
})

router.get("/api/v1/orders", function (request, response) {
  getOrders(request, response)
})
router.delete("/api/v1/orders", function (request, response) {
  const { productordersid } = request.body
  deleteAspecificOrder(productordersid, response)
})

router.post("/api/v1/purchases", async function (request, response) {
  try {
    const { data, tax, totalprice } = request.body
    await new Inventory().receivePurchaseStocks(data, totalprice, tax, response)
  } catch (err) {
    customError("something wrong occured", 500, response)
  }
})

// apis for department requisitions



module.exports = router

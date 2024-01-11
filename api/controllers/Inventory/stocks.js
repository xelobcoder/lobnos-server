const router = require("express").Router();
const { customError } = require("../../../helper");
const logger = require("../../../logger");
const Inventory = require("../../models/Inventory/inventoryclass");

const inventory = new Inventory();

router.put('/api/v1/stock', function (request, response) {
  updateAstock(request, response)
})

router.post('/api/v1/stock/category', function (request, response) {
  addNewStockCategory(request, response)
})

router.get('/api/v1/stock/category', async function (request, response) {
  try {
    const data = await inventory.getStockCategory();
    response.send({ result: data, status: "success", statusCode: 200 });
  } catch (err) {
    logger.error(err);
    customError("something went wrong", 500, response);
  }
})

router.delete('/api/v1/stock/category', function (request, response) {
  deleteStockCategory(request, response)
})

router.delete('/api/v1/stock', function (request, response) {
  deleteAstock(request, response);
})

router.post('/api/v1/stock', async function (request, response) {
  try {
    const outcome = await inventory.addNewStock(request.body);
    if (outcome === 'EXIST') { customError("stock already exist", 404, response); return; }
    if (outcome === false) { customError("New stock addition failed", 500, response); return; }
    response.send({ message: "New stock successfully added", status: 'success', statusCode: 200 });
  } catch (err) {
    customError("something wrong occured", 500, response);
  }
})

router.get('/api/v1/stocks/filter', async function (request, response) {
  const { filter } = request.query;
  if (!filter)
    customError(`filter not included in the request query`, 404, response);
  else {
    const result = await inventory.filterstock(`%${filter}%`.trim());
    response.send({ result, statusCode: 200, status: "success" });
  }
})

router.get('/api/v1/stock', async function (request, response) {
  try {
    const { page, count } = request.query;
    const result = await inventory.getStocks({page,count});
    response.send({ result, statusCode: 200, status: "success" });
  } catch (err) {
    logger.error(err);
    customError("something wrong occured", 500, response);
 }
})


module.exports = router;
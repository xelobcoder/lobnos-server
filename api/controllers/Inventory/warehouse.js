const router = require("express").Router();
const { customError } = require("../../../helper");
const logger = require("../../../logger");
const WareHouse = require("../../models/Inventory/warehouse");
const warehouse = new WareHouse();


router.post("/api/v1/inventory/warehouse", async function (request, response) {
  try {
    const { name } = request.body
    if (!name) { customError("include name of warehouse", 404, response); return}
    const result = await warehouse.addWareHouse(name);
    console.log(result)
    if (result === true) {
      response.send({ message: 'New warehouse added successuly', statusCode: 200, status: 'success' });
    } else if (result === 'EXIST') {
      customError('WareHouse already exist', 404, response); return;
    }
    else {
      response.send({ message: 'Adding new warehouse failed', statusCode: 404, status: 'error' });
    }
  } catch (err) { logger.error(err); customError("something wrong occured", 500,response); }
})



router.get("/api/v1/inventory/warehouse", async function (request, response) {
   try {
     const result = await warehouse.getAllWareHouse();
     response.send({ result, statusCode: 200, status: "success" });
   } catch (err) { logger.error(err); customError("something wrong occured", 500,response); }
})


router.put("/api/v1/inventory/warehouse/:id", async function (request, response) {
  try {
    const { id } = request.params;
    const { name } = request.body;
    if (!name || !id) {
      customError("include name and id of warehouse", 400, response);
      return;
    }
    const updated = await warehouse.updateWarehouse(id, name);
    response.send({
      message: updated ? "Warehouse updated successfully" : "Warehouse not updated,kindly check warehouse id provided", statusCode: updated ? 200 : 400,
      status: updated ? "success" : "error"
    });
  } catch (err) {
    logger.error(err);
    customError("something wrong occured", 500,response);
  }
});

// DELETE endpoint to delete a warehouse by ID
router.delete("/api/v1/inventory/warehouse/:id", async function (request, response) {
  try {
    const { id } = request.params;
    if (!id) { 
      customError("include id of warehouse", 400, response);
      return;
    }
    const deleted = await warehouse.deleteWarehouse(id);
    if (!deleted) {
      response.send({ message: "Warehouse not deleted", statusCode: 404, status: "error" });
      return;
    }
    response.send({ message: "Warehouse deleted successfully", statusCode: 200, status: "success" });
  } catch (err) {
    logger.error(err);
    customError("something wrong occured", 500,response);
  }
});

router.get("/api/v1/inventory/shelve", async function (request, response) {
  try {
    const { target } = request.query;
    if (!target) { customError("target of query required", 404, response); return; }
    if (target === "all") {
      const matched = await warehouse.getShelves();
      response.send({ statusCode: 200, status: 'success', result: matched });
      return;
    }
    
    if (target && typeof target === "number") {
      const matched = await warehouse.getShelf(target);
      response.send({ statusCode: 200, result: matched, status: "success" });
      return;
    }
    customError("wrong target provided", 404, response);
  } catch (err) { logger.error(err); customError(err?.message,500,response); }
})

router.post("/api/v1/inventory/shelve", async function (request, response) {
  try {
    const { warehouseId, name } = request.body;
    if (!warehouseId || !name) { customError("WarehouseId or name not provided", 404, response); return; }
    const result = await warehouse.createShelf(warehouseId, name);
    response.send({message: result  ? 'shelf created successfully' : 'shelf creation failed',statusCode: 200, status: result ?  'success' : 'failed'})
  } catch (err) { logger.error(err); customError("something wrong occured", 500,response); }
})


router.get("/api/v1/inventory/warehouse/shelves", async function (request, response) {
  try {
    const { warehouseId } = request.query;
    if (!warehouseId) { customError("WarehouseId", 404, response); return; }
    const result = await warehouse.getWarehouseShelves(warehouseId);
    response.send({statusCode: 200, status:'success', result})
  } catch (err) {
    logger.error(err);
    console.log(err)
    customError("something wrong occured", 500, response);
  }
})

module.exports = router;
const router = require("express").Router();
const {
          getSuppliers,
          getSupplierStatusUnfulfilled,
          getSupplierById,
          addSupplier,
          deleteSupplier,
          updateSupplier,
          addCommodity,
} = require("../../../dist/controllers/supplys/supplyHandler");
const { handlePlaceOrder, handleGetOrders, handleDeleteAspecificOrder } = require("../../../dist/controllers/supplys/orderHandler");

router.get("/api/v1/suppliers", getSuppliers);
router.get("/api/v1/supplier/status/unforfilled", getSupplierStatusUnfulfilled);
router.get("/api/v1/suppliers/getsupplier", getSupplierById);
router.post("/api/v1/suppliers", addSupplier);
router.delete("/api/v1/suppliers", deleteSupplier);
router.put("/api/v1/suppliers", updateSupplier);
router.post("/api/v1/commodities", addCommodity);


router.post("/api/v1/orders", handlePlaceOrder);
router.get("/api/v1/orders", handleGetOrders);
router.delete("/api/v1/orders", handleDeleteAspecificOrder);


module.exports = router;

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
const { placeOrder, getOrders, deleteAspecificOrder } = require("../../../dist/controllers/supplys/orderHandler");

router.get("/api/v1/suppliers", getSuppliers);
router.get("/api/v1/supplier/status/unforfilled", getSupplierStatusUnfulfilled);
router.get("/api/v1/suppliers/getsupplier", getSupplierById);
router.post("/api/v1/suppliers", addSupplier);
router.delete("/api/v1/suppliers", deleteSupplier);
router.put("/api/v1/suppliers", updateSupplier);
router.post("/api/v1/commodities", addCommodity);


router.post("/api/v1/orders", placeOrder);
router.get("/api/v1/orders", getOrders);
router.delete("/api/v1/orders", deleteAspecificOrder);


module.exports = router;

const router = require("express").Router();
const { handleNewBilling } = require("../../../dist/controllers/billing/controllers");
router.post("/api/v1/billing",handleNewBilling)

module.exports = router; 
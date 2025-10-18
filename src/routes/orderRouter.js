const express = require("express");
const router = express.Router();
const OrderController = require("../controllers/orderController");
const OrderValidators = require("../validators/orderValidators");
const { schemaValidate } = require("../middleware/validate");

router.post(
    "/plan-renewal",
    schemaValidate(OrderValidators.PlanRenewalSchema, "body"),
    OrderController.createPlanRenewalOrder
);

router.post(
    "/plan-purchase",
    schemaValidate(OrderValidators.PlanPurchaseSchema, "body"),
    OrderController.createPlanPurchaseOrder
);

router.post(
    "/group-creation",
    schemaValidate(OrderValidators.GroupCreationSchema, "body"),
    OrderController.createGroupCreationOrder
);

module.exports = router;

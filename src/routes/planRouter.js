const express = require("express");
const PlanController = require("../controllers/planController");

const router = express.Router();

// GET /plans
router.get("/", PlanController.getAllPlans);

module.exports = router;
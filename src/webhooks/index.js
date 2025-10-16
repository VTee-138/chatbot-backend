const express = require("express");
const router = express.Router();

const paymentsRoute = require("./payments");
router.use("/", paymentsRoute)

module.exports = router;
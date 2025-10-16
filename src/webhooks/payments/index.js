const express = require("express");
const router = express.Router();

const sepayCallbackRoute = require("./sepay/sepayCallBackRoute");
router.use("/payments", sepayCallbackRoute)

module.exports = router;
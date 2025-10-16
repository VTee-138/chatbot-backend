const express = require("express");
const router = express.Router();

const sepayCallbackController = require("./sepayCallBackController");

router.post(
    "/sepay/callback",
    sepayCallbackController.handleSepayCallback
);

module.exports = router;

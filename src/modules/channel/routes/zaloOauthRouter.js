const express = require("express");
const router = express.Router();
const ZaloOauthController = require("../controllers/zaloOauthController");

router.post(
    "/initiate-zalo-oauth",
    ZaloOauthController.initiateZaloOAuth
);
router.post(
    "/callback",
    ZaloOauthController.handleZaloCallback
);

module.exports = router;

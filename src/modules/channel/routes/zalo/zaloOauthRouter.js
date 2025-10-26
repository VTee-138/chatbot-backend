const express = require("express");
const router = express.Router();
const ZaloOauthController = require("../../controllers/zalo/zaloOauthController");
const { authenticate } = require("../../../../middleware/auth");

router.post(
    "/initiate-zalo-oauth",
    authenticate,
    ZaloOauthController.initiateZaloOAuth
);
router.post(
    "/callback",
    ZaloOauthController.handleZaloCallback
);

module.exports = router;

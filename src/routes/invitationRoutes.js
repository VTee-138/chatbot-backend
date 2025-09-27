const express = require("express");
const invitationController = require("../controllers/invitationController");
const { authenticate } = require("../middleware/auth");
const router = express.Router();
router.get("/list", invitationController.listPendingInvitations);
router.post("/accept/:token", invitationController.acceptInvitation);
router.post("/decline/:token", invitationController.declineInvitation);

module.exports = router;
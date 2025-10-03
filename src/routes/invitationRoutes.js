const express = require("express");
const invitationController = require("../controllers/invitationController");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

router.get("/list", authenticate, invitationController.listPendingInvitations);
router.post("/accept/:token", authenticate, invitationController.acceptInvitation);
router.post("/decline/:token", authenticate, invitationController.declineInvitation);
router.post("/resend/:invitationId", authenticate, invitationController.resendInvitationEmail);

module.exports = router;
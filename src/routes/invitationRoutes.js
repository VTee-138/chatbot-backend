const express = require("express");
const invitationController = require("../controllers/invitationController");
const { authenticate } = require("../middleware/auth");

/**
 * @swagger
 * /invitations/list:
 * get:
 * summary: Get Pending Invitations
 * description: Retrieves the list of pending invitations for the currently authenticated user.
 * tags: [Invitations]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: A list of pending invitations.
 * content:
 * application/json:
 * schema:
 * allOf:
 * - $ref: '#/components/schemas/SuccessResponse'
 * - type: object
 * properties:
 * data:
 * type: array
 * items:
 * $ref: '#/components/schemas/Invitation' # Bạn cần định nghĩa schema này trong Swagger
 * 403:
 * $ref: '#/components/responses/Forbidden'
 */

const router = express.Router();
router.get("/list", invitationController.listPendingInvitations);
router.post("/accept/:token", invitationController.acceptInvitation);
router.post("/decline/:token", invitationController.declineInvitation);

module.exports = router;

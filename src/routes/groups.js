const express = require("express");
const router = express.Router();
const GroupController = require("../controllers/groupsController");
const { schemaValidate } = require("../middleware/validate");
const groupValidator = require("../validators/groupsValidators");

// Invitations
router.post(
  "/invitations/accept",
  schemaValidate(groupValidator.AcceptInvitationSchema, "body"),
  GroupController.acceptInvitation
);

router.post(
  "/invitations/decline",
  schemaValidate(groupValidator.DeclineInvitationSchema, "body"),
  GroupController.declineInvitation
);

router.get(
  "/invitations/mine/all",
  GroupController.getMyInvitations
);

router.get(
  "/invitations/mine/pending",
  GroupController.getMyPendingInvitations
);

// Groups
router.get(
  "/:id/information",
  schemaValidate(groupValidator.GetGroupInformationSchema, "params"),
  GroupController.getGroupInformation
);

router.get(
  "/:id/members",
  schemaValidate(groupValidator.GetGroupMembersSchema, "params"),
  GroupController.getGroupMembers
);

router.patch(
  "/:id/role",
  schemaValidate(groupValidator.UpdateRoleSchema, "params"),
  schemaValidate(groupValidator.UpdateRoleSchema, "body"),
  GroupController.updateRole
);

router.delete(
  "/:id/members",
  schemaValidate(groupValidator.DeleteMemberSchema, "params"),
  schemaValidate(groupValidator.DeleteMemberSchema, "body"),
  GroupController.deleteMember
);

module.exports = router;

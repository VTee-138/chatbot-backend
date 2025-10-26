const express = require("express");
const router = express.Router();
const GroupController = require("../controllers/groupsController");
const { schemaValidate } = require("../middleware/validate");
const groupValidator = require("../validators/groupsValidators");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
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
  "/role",
  schemaValidate(groupValidator.UpdateRoleSchema, "body"),
  GroupController.updateRole
);

router.delete(
  "/members",
  schemaValidate(groupValidator.DeleteMemberSchema, "body"),
  GroupController.deleteMember
);

// Lấy tất cả nhóm mà user đang tham gia
router.get('/mine', GroupController.getMyGroups);

router.post('/invite',
  schemaValidate(groupValidator.InviteUserToGroupSchema, "body"),
  GroupController.inviteUserToGroup
);

module.exports = router;

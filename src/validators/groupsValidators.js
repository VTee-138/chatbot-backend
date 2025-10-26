const Joi = require("joi");

// Common field schemas
const groupId = Joi.string().uuid().required().messages({
    "string.guid": "Group ID không hợp lệ",
    "any.required": "Thiếu groupId"
});

const userId = Joi.string().uuid().required().messages({
    "string.guid": "User ID không hợp lệ",
    "any.required": "Thiếu userId"
});

const role = Joi.string()
    .valid("member", "manager", "owner")
    .required()
    .messages({
        "any.only": "Role không hợp lệ, chỉ được phép: member, manager, owner",
        "any.required": "Thiếu role"
    });

const status = Joi.string()
    .valid("pending", "accepted", "declined")
    .required()
    .messages({
        "any.only": "Trạng thái không hợp lệ",
        "any.required": "Thiếu status"
    });

class GroupValidators {
    // Chấp nhận lời mời
    static AcceptInvitationSchema = Joi.object({
        groupId,
        status: Joi.string().valid("accepted").required().messages({
            "any.only": "Trạng thái phải là 'accepted'",
            "any.required": "Thiếu status"
        })
    });

    // Từ chối lời mời
    static DeclineInvitationSchema = Joi.object({
        groupId,
        status: Joi.string().valid("declined").required().messages({
            "any.only": "Trạng thái phải là 'declined'",
            "any.required": "Thiếu status"
        })
    });

    // Lấy thông tin group theo id
    static GetGroupInformationSchema = Joi.object({
        id: groupId
    });

    // Lấy danh sách thành viên group
    static GetGroupMembersSchema = Joi.object({
        id: groupId
    });

    // Cập nhật vai trò của thành viên
    static UpdateRoleSchema = Joi.object({
        groupId,
        newRole: role
    });

    // Xoá thành viên khỏi group
    static DeleteMemberSchema = Joi.object({
        groupId
    });
    // Mời user vào group (thêm mới) 
    static InviteUserToGroupSchema = Joi.object({ groupId, userId });
}

module.exports = GroupValidators;

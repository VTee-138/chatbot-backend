const { successResponse, errorResponse, paginatedResponse, catchAsync } = require('../utils/response');
const { createSlug, generateMultipleSlugs } = require('../utils/crypto');
const config = require('../config');
const prisma = require('../config/database');
const groupDBServices = require('../services/groupDBServices');
const { generateTokenPair, generateToken, decodePayload, verifyToken } = require('../utils/jwt');
const { Constants, ErrorResponse } = require('../utils/constant');
const cookieHelper = require('../utils/cookieHelper');
const countryDBServices = require('../services/countryDBServices');
const userCredentialModel = require('../model/userCredentialModel');
const { sendEmailToVerify } = require('../utils/mailService');
const { EmailType, HtmlConverter } = require('../utils/mailConverter');
const invitationDBServices = require('../services/invitationDBServices');
/**
 * Create new group
 */
const createGroup = catchAsync(async (req, res, next) => {
  const { name, slug, country, logo, email, phone } = req.body;
  const clientId = req.user.id; 

  const nameExists = await groupDBServices.getNameState(name);
  if (nameExists) throw new ErrorResponse("This name has been existed!", Constants.BAD_REQUEST);

  const slugExists = await groupDBServices.getSlugState(slug);
  if (slugExists) {
    const slugs = await groupDBServices.getSlugsRelate(slug);
    let newSlugs = [];
    while (newSlugs.length < 3) {
      const newSlug = generateMultipleSlugs(slug);
      if (!slugs.slug.includes(newSlug) && !newSlugs.includes(newSlug)) {
        newSlugs.push(newSlug);
      }
    }
    return errorResponse(res, {
      message: "Slug exists!",
      valid_slugs: newSlugs
    }, Constants.BAD_REQUEST);
  }

  const countryCode = await countryDBServices.getCountryCodeByName(country);
  if (!countryCode) throw new ErrorResponse("Country not found", Constants.NOT_FOUND);

  const group = await groupDBServices.createNewGroup({
    name,
    slug,
    logoUrl: logo,
    phoneContact: phone,
    emailContact: email,
    countryCode: countryCode.code
  }, clientId);

  return successResponse(res, group, 'Group created successfully', 201);
});


/**
 * Get user's groups
 */
const getUserGroups = catchAsync(async (req, res, next) => {
  // SỬA: Lấy clientId từ req.user
  const clientId = req.user.id;
  const groups = await groupDBServices.getMemberships(clientId);

  const memberships = groups.map(group => ({
    id: group.groups.id,
    name: group.groups.name,
    displayName: group.groups.name,
    country: 'VN', // Cần làm rõ logic lấy country
    logo: group.groups.logoUrl,
    role: group.role,
    createdAt: group.groups.createdAt,
    updatedAt: group.groups.updatedAt,
  }));

  const response = {
    userId: clientId,
    total: memberships.length,
    groups: memberships
  };
  return successResponse(res, response, 'Groups retrieved successfully');
});

/**
 * Get g  const group = await groupDBServices.getGroupById(groupId);
       apiKeys: true,
        },
      },
  
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      creator: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      _count: {
        select: {
          members: true,
          apiKeys: true,
        },
      },
    },
  });

  if (!group) {
    return errorResponse(res, 'Group not found', 404);
  }
  
 'Group not found', 404);
  }
  
  return successResponse(res, group, 'Group retrieved successfully');
});

/**
 * Update group
 */
const updateGroup = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const dataChanges = req.body;
  
  try {
    // Update group
    const group = await groupDBServices.updateGroupInformation(id, dataChanges)
    return successResponse(res, group, 'Group updated successfully');
  } catch (error) {
    next(error)
  }
});

/**
 * Delete group
 */
const deleteGroup = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  try {
    // Delete group (cascade will handle members, api keys, etc.)
    await groupDBServices.deleteGroup(id)
    return successResponse(res, null, 'Group deleted successfully');
  } catch (error) {
    next(error)
  }
});

/**
 * Get group members
 */
  const getGroupMembers = catchAsync(async (req, res, next) => {
    const  groupId  = req.params.id;
    try {
      const members = await groupDBServices.getGroupMembers(groupId)
      const memberTotal = await groupDBServices.getTotalMembersOfGroup(groupId)
      const response = {
        total : memberTotal,
        members: members.map(m => ({
          memberId: m.id,
          userId: m.users.id,
          email: m.users.email,
          name: m.users.userName,
          avatarUrl: m.users.avatarUrl,
          role: m.role,
          joinedAt: m.createdAt,
        }))
      }
      return successResponse(res, response);
    } catch (error) {
      next(error)
    }
  });

/**
 * Invite user to group
 */
const inviteMember = catchAsync(async (req, res, next) => {
  const { id } = req.params; // id của group
  // SỬA: Lấy clientId của người mời từ req.user
  const inviterId = req.user.id; 
  const { email, userName, role = 'MEMBER' } = req.body;

  let userToInvite;
  if (email) {
    userToInvite = await userCredentialModel.findUserByEmail(email);
  }
  if (!userToInvite && userName) {
    userToInvite = await userCredentialModel.findAccountWithUserName(userName);
  }

  if (!userToInvite) {
    return next(new ErrorResponse('User not found', Constants.NOT_FOUND));
  }

  const existingMembership = await groupDBServices.isMemberExisted(userToInvite.id, id);
  if (existingMembership) {
    return next(new ErrorResponse('User is already a member of this group', Constants.CONFLICT));
  }

  // SỬA: Sử dụng nhất quán jwt utility đã import
  const invitationToken = jwt.generateToken({
    userId: userToInvite.id,
    email: userToInvite.email,
    groupId: id, // Sửa: Tên trường rõ ràng hơn
    role
  }, 'invitation_mail');

  const exp = jwt.decodePayload(invitationToken).exp; // Lấy exp từ token

  await invitationDBServices.createInvitation({
    email: userToInvite.email,
    groupId: id,
    invitedById: inviterId, // ID của người mời
    role,
    token: invitationToken,
    expiresAt: new Date(exp * 1000), // Convert Unix timestamp to Date object
  });

  sendEmailToVerify(
    EmailType.GROUP_INVITATION,
    config.URL_MAIL_PUBLIC,
    invitationToken,
    userToInvite.email,
    `You have been invited to join a group`,
    HtmlConverter.GroupInvitation
  );

  return successResponse(res, null, 'Invitation sent successfully');
});

/**
 * Update member role
 */
const updateMemberRole = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const memberId = req.params.memberId
  const { role } = req.body;
  try {
    // Check owner 
    const groupOwner = await groupDBServices.getGroupById(id)
    
    if (groupOwner.creatorId === memberId) {
      return errorResponse(res, 'Nonsense Request', Constants.BAD_REQUEST);
    }
    // Update member role
    const membership = await groupDBServices.updateMemberRoleById(role, memberId, id)
    return successResponse(res, membership, 'Member role updated successfully');
  } catch (error) {
    next(error)
  }
});

/**
 * Remove member from group
 */
const removeMember = catchAsync(async (req, res, next) => { 
  const { id, memberId } = req.params;
  
  try {
    // Cannot remove group creator
    const owner = groupDBServices.getOwnerGroupById(id)
    if (owner.creatorId === memberId) {
      return errorResponse(res, 'Cannot remove group creator', 400);
    }
    // Remove
    await groupDBServices.deleteMember(memberId, id)
    
    return successResponse(res, null, 'Member removed successfully');
  } catch (error) {
    next(error)
  }
});

/**
 * Leave group
 */
const leaveGroup = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const clientId = req.user.id; // Hàm này đã dùng đúng `req.user.id` từ trước

  const group = await prisma.group.findUnique({
    where: { id: id },
    select: { creatorId: true },
  });

  if (!group) {
    return errorResponse(res, 'Group not found', 404);
  }

  if (group.creatorId === clientId) {
    return errorResponse(res, 'Group creator cannot leave. Transfer ownership or delete group.', 400);
  }

  await prisma.groupMember.delete({
    where: {
      userId_groupId: {
        userId: clientId,
        groupId: id,
      },
    },
  });

  return successResponse(res, null, 'Left group successfully');
});


module.exports = {
  createGroup,
  getUserGroups,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  leaveGroup,
};
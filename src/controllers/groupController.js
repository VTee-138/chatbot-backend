const { successResponse, errorResponse, paginatedResponse, catchAsync } = require('../utils/response');
const { createSlug, generateMultipleSlugs } = require('../utils/crypto');
const config = require('../config');
const prisma = require('../config/database');
const groupDBServices = require('../services/groupDBServices');
const { Constants, ErrorResponse } = require('../utils/constant');
const cookieHelper = require('../utils/cookieHelper');
const countryDBServices = require('../services/countryDBServices');
const userCredentialModel = require('../model/userCredentialModel');
const { sendEmailToVerify } = require('../utils/mailService');
const { EmailType, HtmlConverter } = require('../utils/mailConverter');
const jwt = require('../utils/jwt');
const invitationDBServices = require('../services/invitationDBServices');
/**
 * Create new group
 */
const createGroup = catchAsync(async (req, res, next) => {
  const { name, slug, country, logo, email, phone} = req.body;
  try {
    // Ensure slug is unique
    const nameExists = await groupDBServices.getNameState(name)
    const slugExists = await groupDBServices.getSlugState(slug)
    const clientId = cookieHelper.getClientId(req)
    if (nameExists) throw new ErrorResponse("This name has been existed!", Constants.BAD_REQUEST)
    // If slug exists, return error with output recommends slugs
    if (slugExists) {
      // Tìm các slugs mà pattern like %slug%
      const slugs = await groupDBServices.getSlugsRelate(slug)
  
      // Gen ra 3 slug không nằm trong slugs này để recommend chon người dùng 
      let newSlugs = []
      while (newSlugs.length < 3){
        const newSlug = generateMultipleSlugs(slug)
        if (!slugs.slug.includes(newSlug) && !newSlugs.includes(newSlug)) {
          newSlugs.push(newSlug);
        }
      }
      return errorResponse(res, {
        message: "Slugs exists!", 
        valid_slugs: newSlugs
      }, Constants.BAD_REQUEST)
    }

    const countryCode = await countryDBServices.getCountryCodeByName(country)
    if (!countryCode) throw new ErrorResponse("Country not found", Constants.NOT_FOUND)

    // Create group with creator as owner
    const group = await groupDBServices.createNewGroup(
      { 
        name, 
        slug, 
        logoUrl: logo, 
        phoneContact: phone, 
        emailContact: email, 
        countryCode: countryCode.code
      }, 
      clientId)
    
    return successResponse(res, group, 'Group created successfully', 201);
  } catch (error) {
    next(error)
  }
});


/**
 * Get user's groups
 */
const getUserGroups = catchAsync(async (req, res, next) => {
  const clientId = cookieHelper.getClientId(req)
  const groups = await groupDBServices.getMemberships(clientId)
  
  try {
    const memberships = groups.map(group => ({
      id: group.groups.id,
      name: group.groups.name,
      displayName: group.groups.name, // Chịu database không có 
      country: 'VN',
      logo: group.groups.logoUrl,
      role: group.role, // Role user in group
      createdAt: group.groups.createdAt,
      updatedAt: group.groups.updatedAt,
    }));
    
    const response = {
      userId: clientId,
      total: memberships.length,
      groups: memberships
    }
    return successResponse(res, response, 'Groups retrieved successfully');
  } catch (error) {
    next(error)
  }
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
    const { id } = req.params;
    const clientId = cookieHelper.getClientId(req);
    const { email, userName, role = 'MEMBER' } = req.body;

    try {
      let user;
      if (email) {
          user = await userCredentialModel.findUserByEmail(email);
      }
      if (!user && userName) {
          user = await userCredentialModel.findAccountWithUserName(userName);
      }
  
      if (!user) {
          return next(new ErrorResponse('User not found', Constants.NOT_FOUND));
      }
  
      const existingMembership = await groupDBServices.isMemberExisted(user.id, id);
      if (existingMembership) {
          return next(new ErrorResponse('User is already a member of this group', Constants.CONFLICT));
      }
  
      const invitationToken = jwt.generateToken({
         userId: user.id, 
         email: user.email, 
         id, 
         role 
        }, 'invitation_mail');
        const exp = jwt.getEXP(invitationToken)
      invitationDBServices.createInvitation({
          email: user.email,
          groupId: id,
          invitedById: clientId,
          role,
          token: invitationToken,
          expiresAt: exp,
      });
  
      sendEmailToVerify(
          EmailType.GROUP_INVITATION,
          config.URL_MAIL_PUBLIC, // This will be the domain
          invitationToken, // This will be the code
          user.email,
          `You have been invited to join a group`,
          HtmlConverter.GroupInvitation
      );
  
      return successResponse(res, null, 'Invitation sent successfully');
    } catch (error) {
      next(error)
    }
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
  
 try {
   // Cannot leave if user is the creator
   const group = await prisma.group.findUnique({
     where: { id: id },
     select: { creatorId: true },
   });
   
   if (group.creatorId === req.user.id) {
     return errorResponse(res, 'Group creator cannot leave. Transfer ownership or delete group.', 400);
   }
   
   // Remove membership
   await prisma.groupMember.delete({
     where: {
       userId_groupId: {
         userId: req.user.id,
         groupId: id,
       },
     },
   });
   
   return successResponse(res, null, 'Left group successfully');
 } catch (error) {
   next(error)
 }
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

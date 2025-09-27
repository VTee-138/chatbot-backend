const { successResponse, errorResponse, paginatedResponse, catchAsync } = require('../utils/response');
const { createSlug } = require('../utils/crypto');
const config = require('../config');
const prisma = require('../config/database');
const groupDBServices = require('../services/groupDBServices');
const { Constants } = require('../utils/constant');
const cookieHelper = require('../utils/cookieHelper');

/**
 * Create new group
 */
const createGroup = catchAsync(async (req, res) => {
  console.log(req.user.id);
  const { name, description, logo } = req.body;

  if (!name) {
    return errorResponse(res, "Group name is required", 400);
  }

  // Create slug from name
  let slug = createSlug(name);

  // Ensure slug is unique
  let slugExists = await prisma.groups.findUnique({ where: { slug } });
  let slugSuffix = 1;

  while (slugExists) {
    slug = `${createSlug(name)}-${slugSuffix}`;
    slugExists = await prisma.groups.findUnique({ where: { slug } });
    slugSuffix++;
  }
  console.log(crypto.randomUUID());
  // Create group with creator as owner
  const group = await prisma.groups.create({
    data: {
      id: crypto.randomUUID(),
      name,
      slug,
      logoUrl: logo,
      creatorId: req.user.id,
      updatedAt: new Date(),
      group_members: {
        create: {
          id: crypto.randomUUID(),
          userId: req.user.id,
          role: 'OWNER',
          updatedAt: new Date(),  // phải thêm
        },
      },
    },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          userName: true,
          avatarUrl: true
        }
      },
      group_members: {
        include: {
          users: {
            select: {
              id: true,
            },
          },
        },
      },
      _count: {
        select: {
          group_members: true,
          ai_usage_logs: true,
        },
      },
    },
  });

  return successResponse(res, group, 'Group created successfully', 201);
});


/**
 * Get user's groups
 */
const getUserGroups = catchAsync(async (req, res) => {
  const clientId = cookieHelper.getClientId(req)
  const groups = await groupDBServices.getMemberships(clientId)
  console.log(clientId);
  console.log(groups);
  const memberships = groups.map(group => ({
    id: group.groups.id,
    name: group.groups.name,
    displayName: group.groups.name, // Chịu database không có
    country: 'VN', // Hardcode vì có để trong db đâu 
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
});

/**
 * Get group by ID
 */
const getGroupById = catchAsync(async (req, res) => {
  const { groupId } = req.params;

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

  return successResponse(res, group, 'Group retrieved successfully');
});

/**
 * Update group
 */
const updateGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { name, description, logo } = req.body;

  // Update group
  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      name,
      description,
      logo,
      updatedAt: new Date(),
    },
    include: {
      creator: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          members: true,
          apiKeys: true,
        },
      },
    },
  });

  return successResponse(res, group, 'Group updated successfully');
});

/**
 * Delete group
 */
const deleteGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params;

  // Delete group (cascade will handle members, api keys, etc.)
  await groupDBServices.deleteGroup(groupId)

  return successResponse(res, null, 'Group deleted successfully');
});

/**
 * Get group members
 */
const getGroupMembers = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const member = await groupDBServices.getGroupMembers(groupId)
  const memberTotal = await groupDBServices.getTotalMembersOfGroup(groupId)
  const response = {
    total: memberTotal,
    members: {
      memberId: member.id, // ID của bản ghi group_members
      userId: member.users.id, // ID trong bảng user
      email: member.users.email,
      name: member.users.userName,
      avatarUrl: member.users.avatarUrl,
      role: member.role,
      joinedAt: member.createdAt,
    }
  }

  return successResponse(res, response);
});

/**
 * Invite user to group
 */
const inviteMember = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { email, role = 'MEMBER' } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  if (!user) {
    return errorResponse(res, 'User with this email not found', 404);
  }

  if (!user.isActive) {
    return errorResponse(res, 'User account is disabled', 400);
  }

  // Check if user is already a member
  const existingMembership = await prisma.groupMember.findUnique({
    where: {
      userId_groupId: {
        userId: user.id,
        groupId,
      },
    },
  });

  if (existingMembership) {
    return errorResponse(res, 'User is already a member of this group', 409);
  }

  // Create membership
  const membership = await prisma.groupMember.create({
    data: {
      userId: user.id,
      groupId,
      role,
    },
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
  });

  return successResponse(res, membership, 'Member invited successfully', 201);
});

/**
 * Update member role
 */
const updateMemberRole = catchAsync(async (req, res) => {
  const { grId, memberId } = req.params;
  const { role } = req.body;

  // Check owner 
  const groupOwner = groupDBServices.getGroupById(grId)

  if (groupOwner.creatorId === memberId) {
    return errorResponse(res, 'Nonsense Request', Constants.BAD_REQUEST);
  }
  // Update member role
  const membership = await groupDBServices.updateMemberRoleById(role, memberId, grId)
  return successResponse(res, membership, 'Member role updated successfully');
});

/**
 * Remove member from group
 */
const removeMember = catchAsync(async (req, res) => {
  const { grId, memberId } = req.params;

  // Cannot remove group creator
  const owner = groupDBServices.getOwnerGroupById(grId)
  if (owner.creatorId === memberId) {
    return errorResponse(res, 'Cannot remove group creator', 400);
  }
  // Remove
  await groupDBServices.deleteMember(memberId, grId)

  return successResponse(res, null, 'Member removed successfully');
});

/**
 * Leave group
 */
const leaveGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params;

  // Cannot leave if user is the creator
  const group = await prisma.group.findUnique({
    where: { id: groupId },
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
        groupId,
      },
    },
  });

  return successResponse(res, null, 'Left group successfully');
});

module.exports = {
  createGroup,
  getUserGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  leaveGroup,
};

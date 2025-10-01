const { successResponse, errorResponse, paginatedResponse, catchAsync } = require('../utils/response');
const { createSlug } = require('../utils/crypto');
const config = require('../config');
const prisma = require('../config/database');
const groupDBServices = require('../services/groupDBServices');
const { Constants } = require('../utils/constant');
const cookieHelper = require('../utils/cookieHelper');

/**
 * Create first group (Onboarding)
 */
const createFirstGroup = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { name, description, industry } = req.body;

  if (!name) {
    return errorResponse(res, "Group name is required", 400);
  }

  // Check xem user đã có group nào chưa
  const existingMemberships = await prisma.group_members.count({
    where: { userId }
  });
  
  if (existingMemberships > 0) {
    return errorResponse(res, 'User already has groups. Use regular create endpoint.', 400);
  }

  // Get default FREE plan
  const freePlan = await prisma.plans.findFirst({
    where: { type: 'FREE' }
  });

  if (!freePlan) {
    return errorResponse(res, 'Default plan not found', 500);
  }

  // Create unique slug
  let slug = createSlug(name);
  let slugExists = await prisma.groups.findUnique({ where: { slug } });
  let slugSuffix = 1;

  while (slugExists) {
    slug = `${createSlug(name)}-${slugSuffix}`;
    slugExists = await prisma.groups.findUnique({ where: { slug } });
    slugSuffix++;
  }

  // Create group with membership and subscription
  const group = await prisma.groups.create({
    data: {
      id: crypto.randomUUID(),
      name,
      slug,
      creatorId: userId,
      receptionMode: 'MANUAL',
      creditBalance: freePlan.monthlyCreditsGranted,
      updatedAt: new Date(),
      group_members: {
        create: {
          id: crypto.randomUUID(),
          userId,
          role: 'OWNER',
          canBeAssigned: true,
          assignmentWeight: 10,
          updatedAt: new Date(),
        },
      },
      subscriptions: {
        create: {
          id: crypto.randomUUID(),
          planId: freePlan.id,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
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
              userName: true,
              email: true,
              avatarUrl: true
            },
          },
        },
      },
      subscriptions: {
        include: {
          plans: true
        }
      },
      _count: {
        select: {
          group_members: true,
          channels: true,
          conversations: true
        },
      },
    },
  });

  return successResponse(res, {
    ...group,
    isFirstGroup: true,
    plan: group.subscriptions.plans
  }, 'First group created successfully', 201);
});

/**
 * Create additional group
 */
const createGroup = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { name, description, receptionMode = 'MANUAL' } = req.body;

  if (!name) {
    return errorResponse(res, "Group name is required", 400);
  }

  // Check user's group ownership limits
  const ownedGroupsCount = await prisma.group_members.count({
    where: { 
      userId,
      role: 'OWNER'
    }
  });

  // Get user's plan limits from their first group
  const userFirstGroup = await prisma.group_members.findFirst({
    where: { userId },
    include: {
      groups: {
        include: {
          subscriptions: {
            include: { plans: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const userPlan = userFirstGroup?.groups?.subscriptions?.plans;
  if (!userPlan) {
    return errorResponse(res, 'User plan not found', 400);
  }

  if (ownedGroupsCount >= userPlan.maxGroups) {
    return errorResponse(res, `Group limit exceeded. Your ${userPlan.name} plan allows ${userPlan.maxGroups} groups.`, 403);
  }

  // Create unique slug
  let slug = createSlug(name);
  let slugExists = await prisma.groups.findUnique({ where: { slug } });
  let slugSuffix = 1;

  while (slugExists) {
    slug = `${createSlug(name)}-${slugSuffix}`;
    slugExists = await prisma.groups.findUnique({ where: { slug } });
    slugSuffix++;
  }

  // Create new group
  const group = await prisma.groups.create({
    data: {
      id: crypto.randomUUID(),
      name,
      slug,
      creatorId: userId,
      receptionMode,
      creditBalance: userPlan.monthlyCreditsGranted,
      updatedAt: new Date(),
      group_members: {
        create: {
          id: crypto.randomUUID(),
          userId,
          role: 'OWNER',
          canBeAssigned: true,
          assignmentWeight: 10,
          updatedAt: new Date(),
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
              userName: true,
              email: true,
              avatarUrl: true
            },
          },
        },
      },
      _count: {
        select: {
          group_members: true,
          channels: true,
          conversations: true
        },
      },
    },
  });

  return successResponse(res, group, 'Group created successfully', 201);
});


/**
 * Get user's groups with enhanced information
 */
const getUserGroups = catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  const userGroups = await prisma.group_members.findMany({
    where: { userId },
    include: {
      groups: {
        include: {
          subscriptions: {
            include: { plans: true }
          },
          _count: {
            select: {
              group_members: true,
              channels: true,
              conversations: true,
              customers: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  const groupsWithStats = userGroups.map(membership => ({
    id: membership.groups.id,
    name: membership.groups.name,
    slug: membership.groups.slug,
    logoUrl: membership.groups.logoUrl,
    receptionMode: membership.groups.receptionMode,
    creditBalance: membership.groups.creditBalance,
    createdAt: membership.groups.createdAt,
    updatedAt: membership.groups.updatedAt,
    membership: {
      id: membership.id,
      role: membership.role,
      joinedAt: membership.createdAt,
      canBeAssigned: membership.canBeAssigned,
      assignmentWeight: membership.assignmentWeight
    },
    stats: {
      members: membership.groups._count.group_members,
      channels: membership.groups._count.channels,
      conversations: membership.groups._count.conversations,
      customers: membership.groups._count.customers
    },
    plan: membership.groups.subscriptions ? {
      id: membership.groups.subscriptions.plans.id,
      name: membership.groups.subscriptions.plans.name,
      type: membership.groups.subscriptions.plans.type,
      maxGroups: membership.groups.subscriptions.plans.maxGroups,
      maxMembersPerGroup: membership.groups.subscriptions.plans.maxMembersPerGroup,
      maxChannelsPerGroup: membership.groups.subscriptions.plans.maxChannelsPerGroup,
      monthlyCreditsGranted: membership.groups.subscriptions.plans.monthlyCreditsGranted
    } : null
  }));
  
  return successResponse(res, {
    userId,
    total: groupsWithStats.length,
    groups: groupsWithStats,
    needsOnboarding: groupsWithStats.length === 0
  }, 'Groups retrieved successfully');
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
 * Switch active group
 */
const switchActiveGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;
  
  // Verify user is member of this group
  const membership = await prisma.group_members.findUnique({
    where: {
      userId_groupId: { userId, groupId }
    },
    include: {
      groups: {
        include: {
          subscriptions: {
            include: { plans: true }
          }
        }
      }
    }
  });
  
  if (!membership) {
    return errorResponse(res, 'Access denied to this group', 403);
  }
  
  // Create group context
  const groupContext = {
    id: membership.groups.id,
    name: membership.groups.name,
    slug: membership.groups.slug,
    role: membership.role,
    canBeAssigned: membership.canBeAssigned,
    plan: membership.groups.subscriptions?.plans
  };
  
  // Set active group cookie
  const { httpOnlyResponse } = require('../utils/response');
  const { Constants } = require('../utils/constant');
  
  httpOnlyResponse(res, 'activeGroup', JSON.stringify(groupContext), Constants.TIME_PICKER._7day_ms);
  
  return successResponse(res, groupContext, 'Active group switched successfully');
});

/**
 * Get active group context
 */
const getActiveGroup = catchAsync(async (req, res) => {
  const activeGroupCookie = req.cookies.activeGroup;
  
  if (!activeGroupCookie) {
    return errorResponse(res, 'No active group set', 400);
  }
  
  const activeGroup = JSON.parse(activeGroupCookie);
  
  // Verify group still exists and user still has access
  const membership = await prisma.group_members.findUnique({
    where: {
      userId_groupId: { 
        userId: req.user.id, 
        groupId: activeGroup.id 
      }
    },
    include: {
      groups: {
        include: {
          subscriptions: {
            include: { plans: true }
          },
          _count: {
            select: {
              group_members: true,
              channels: true,
              conversations: true,
              customers: true
            }
          }
        }
      }
    }
  });
  
  if (!membership) {
    return errorResponse(res, 'Active group access denied', 403);
  }
  
  const groupData = {
    id: membership.groups.id,
    name: membership.groups.name,
    slug: membership.groups.slug,
    logoUrl: membership.groups.logoUrl,
    receptionMode: membership.groups.receptionMode,
    creditBalance: membership.groups.creditBalance,
    membership: {
      role: membership.role,
      canBeAssigned: membership.canBeAssigned,
      assignmentWeight: membership.assignmentWeight
    },
    stats: membership.groups._count,
    plan: membership.groups.subscriptions?.plans
  };
  
  return successResponse(res, groupData, 'Active group retrieved successfully');
});

/**
 * Leave group
 */
const leaveGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  // Cannot leave if user is the creator
  const group = await prisma.groups.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });

  if (group.creatorId === userId) {
    return errorResponse(res, 'Group creator cannot leave. Transfer ownership or delete group.', 400);
  }

  // Remove membership
  await prisma.group_members.delete({
    where: {
      userId_groupId: {
        userId,
        groupId,
      },
    },
  });

  return successResponse(res, null, 'Left group successfully');
});

module.exports = {
  createFirstGroup,
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
  switchActiveGroup,
  getActiveGroup,
};

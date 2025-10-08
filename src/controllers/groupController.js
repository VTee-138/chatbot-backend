const { successResponse, errorResponse, paginatedResponse, catchAsync } = require('../utils/response');
const { createSlug } = require('../utils/crypto');
const config = require('../config');
const prisma = require('../config/database');
const groupDBServices = require('../services/groupDBServices');
const { Constants } = require('../utils/constant');
const cookieHelper = require('../utils/cookieHelper');
const invitationService = require('../services/invitationService');
const logger = require('../utils/logger');

/**
 * Create first group (Onboarding)
 */
const createFirstGroup = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { name, description, receptionMode = 'MANUAL', emailContact, phoneContact, countryCode } = req.body;

  if (!name) {
    return errorResponse(res, "Group name is required", 400);
  }

  if (!emailContact) {
    return errorResponse(res, "Email contact is required", 400);
  }

  if (!phoneContact) {
    return errorResponse(res, "Phone contact is required", 400);
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

  // Create group with membership and subscription (always FREE plan by default)
  const group = await prisma.groups.create({
    data: {
      id: crypto.randomUUID(),
      name,
      slug,
      creatorId: userId,
      receptionMode,
      emailContact,
      phoneContact,
      countryCode: countryCode || null,
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
    plan: group.subscriptions?.[0]?.plans || null
  }, 'First group created successfully', 201);
});

/**
 * Create additional group
 */
const createGroup = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { name, description, receptionMode = 'MANUAL', emailContact, phoneContact, countryCode } = req.body;

  if (!name) {
    return errorResponse(res, "Group name is required", 400);
  }

  if (!emailContact) {
    return errorResponse(res, "Email contact is required", 400);
  }

  if (!phoneContact) {
    return errorResponse(res, "Phone contact is required", 400);
  }

  // Check if this is user's first group - if so, redirect to onboarding
  const existingGroupsCount = await prisma.group_members.count({
    where: { userId }
  });

  if (existingGroupsCount === 0) {
    return errorResponse(res, 'Please create your first group using /groups/onboarding endpoint', 400, {
      code: 'FIRST_GROUP_REQUIRED',
      redirectTo: '/groups/onboarding'
    });
  }

  // Get default FREE plan (all new groups start with FREE plan)
  const freePlan = await prisma.plans.findFirst({
    where: { type: 'FREE' }
  });

  if (!freePlan) {
    return errorResponse(res, 'Default plan not found', 500);
  }

  // Check user's group ownership limits based on their first group's plan
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
            where: { status: 'ACTIVE' },
            include: { plans: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  logger.debug('User first group:', JSON.stringify(userFirstGroup, null, 2));

  // Validate user has a group with subscription
  if (!userFirstGroup || !userFirstGroup.groups) {
    return errorResponse(res, 'No groups found. Please contact support.', 400, {
      code: 'NO_GROUPS_FOUND',
      hint: 'User should have at least one group to create additional groups'
    });
  }

  logger.debug('Subscriptions array:', userFirstGroup.groups.subscriptions);

  // Get the most recent active subscription
  const subscriptions = userFirstGroup.groups.subscriptions;
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    logger.error('No subscriptions found. Full group data:', JSON.stringify(userFirstGroup.groups, null, 2));
    return errorResponse(res, 'No active subscription found. Please contact support.', 400, {
      code: 'NO_ACTIVE_SUBSCRIPTION',
      hint: 'Your first group may not have a valid plan assigned'
    });
  }

  // Sort and get the most recent subscription
  const sortedSubscriptions = subscriptions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const activeSubscription = sortedSubscriptions[0];
  
  if (!activeSubscription || !activeSubscription.plans) {
    return errorResponse(res, 'No active plan found. Please contact support.', 400, {
      code: 'NO_ACTIVE_PLAN',
      hint: 'Your subscription does not have a valid plan assigned'
    });
  }

  const userPlan = activeSubscription.plans;

  // Check if user can create more groups based on their current plan
  if (ownedGroupsCount >= userPlan.maxGroups) {
    return errorResponse(res, `Group limit exceeded. Your ${userPlan.name} plan allows ${userPlan.maxGroups} groups.`, 403, {
      code: 'GROUP_LIMIT_EXCEEDED',
      currentCount: ownedGroupsCount,
      maxAllowed: userPlan.maxGroups,
      planName: userPlan.name,
      hint: 'Upgrade your plan to create more groups'
    });
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

  // Create new group with FREE plan by default (user can upgrade later)
  const group = await prisma.groups.create({
    data: {
      id: crypto.randomUUID(),
      name,
      slug,
      creatorId: userId,
      receptionMode,
      emailContact,
      phoneContact,
      countryCode: countryCode || null,
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
    plan: group.subscriptions?.[0]?.plans || null
  }, 'Group created successfully', 201);
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
    plan: membership.groups.subscriptions?.[0]?.plans ? {
      id: membership.groups.subscriptions[0].plans.id,
      name: membership.groups.subscriptions[0].plans.name,
      type: membership.groups.subscriptions[0].plans.type,
      maxGroups: membership.groups.subscriptions[0].plans.maxGroups,
      maxMembersPerGroup: membership.groups.subscriptions[0].plans.maxMembersPerGroup,
      maxChannelsPerGroup: membership.groups.subscriptions[0].plans.maxChannelsPerGroup,
      monthlyCreditsGranted: membership.groups.subscriptions[0].plans.monthlyCreditsGranted
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

  const group = await prisma.groups.findUnique({
    where: { id: groupId },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          userName: true,
          avatarUrl: true,
        },
      },
      group_members: {
        include: {
          users: {
            select: {
              id: true,
              email: true,
              userName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      subscriptions: {
        include: { plans: true }
      },
      _count: {
        select: {
          group_members: true,
          channels: true,
          conversations: true,
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
  const { name, logoUrl, receptionMode, emailContact, phoneContact, countryCode } = req.body;

  // Build update data object with only provided fields
  const updateData = {
    updatedAt: new Date()
  };
  
  if (name) updateData.name = name;
  if (logoUrl) updateData.logoUrl = logoUrl;
  if (receptionMode) updateData.receptionMode = receptionMode;
  if (emailContact) updateData.emailContact = emailContact;
  if (phoneContact) updateData.phoneContact = phoneContact;
  if (countryCode !== undefined) updateData.countryCode = countryCode;

  // Update group
  const group = await prisma.groups.update({
    where: { id: groupId },
    data: updateData,
    include: {
      users: {
        select: {
          id: true,
          email: true,
          userName: true,
          avatarUrl: true,
        },
      },
      subscriptions: {
        include: { plans: true }
      },
      _count: {
        select: {
          group_members: true,
          channels: true,
          conversations: true,
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
  
  const members = await prisma.group_members.findMany({
    where: { groupId },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          userName: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  const response = {
    total: members.length,
    members: members.map(member => ({
      memberId: member.id, // ID của bản ghi group_members
      userId: member.users.id, // ID trong bảng user
      email: member.users.email,
      name: member.users.userName,
      avatarUrl: member.users.avatarUrl,
      role: member.role,
      canBeAssigned: member.canBeAssigned,
      assignmentWeight: member.assignmentWeight,
      joinedAt: member.createdAt,
    }))
  };

  return successResponse(res, response);
});

/**
 * Invite user to group via email
 */
const inviteMember = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { email, role = 'MEMBER' } = req.body;
  const inviter = req.user;

  if (!email) {
    return errorResponse(res, 'Email is required', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return errorResponse(res, 'Invalid email format', 400);
  }

  // Get group information
  const group = await prisma.groups.findUnique({
    where: { id: groupId },
    include: {
      subscriptions: {
        include: { plans: true }
      },
      _count: {
        select: { group_members: true }
      }
    }
  });

  if (!group) {
    return errorResponse(res, 'Group not found', 404);
  }

  // Check member limit based on plan
  const plan = group.subscriptions?.[0]?.plans;
  if (plan && group._count.group_members >= plan.maxMembersPerGroup) {
    return errorResponse(res, `Member limit reached. Your ${plan.name} plan allows ${plan.maxMembersPerGroup} members.`, 403);
  }

  // Create invitation and send email
  const invitation = await invitationService.createInvitation(groupId, inviter, email, role);

  return successResponse(res, {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt
    },
    message: 'Invitation email sent successfully'
  }, 'Member invited successfully', 201);
});

/**
 * Update member role
 */
const updateMemberRole = catchAsync(async (req, res) => {
  const { groupId, memberId } = req.params;
  const { role } = req.body;

  // Validate role
  if (!['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
    return errorResponse(res, 'Invalid role. Must be OWNER, ADMIN, MEMBER, or VIEWER', 400);
  }

  // Check if group exists and get creator
  const group = await prisma.groups.findUnique({
    where: { id: groupId },
    select: { creatorId: true }
  });

  if (!group) {
    return errorResponse(res, 'Group not found', 404);
  }

  // Cannot change owner's role
  if (group.creatorId === memberId) {
    return errorResponse(res, 'Cannot change group owner role', 400);
  }
  
  // Update member role
  const membership = await prisma.group_members.update({
    where: {
      userId_groupId: { userId: memberId, groupId: groupId }
    },
    data: {
      role,
      updatedAt: new Date()
    },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          userName: true,
          avatarUrl: true
        }
      }
    }
  });
  
  return successResponse(res, membership, 'Member role updated successfully');
});

/**
 * Remove member from group
 */
const removeMember = catchAsync(async (req, res) => {
  const { groupId, memberId } = req.params;

  // Check if group exists and get creator
  const group = await prisma.groups.findUnique({
    where: { id: groupId },
    select: { creatorId: true }
  });

  if (!group) {
    return errorResponse(res, 'Group not found', 404);
  }

  // Cannot remove group creator
  if (group.creatorId === memberId) {
    return errorResponse(res, 'Cannot remove group creator', 400);
  }
  
  // Remove member
  await prisma.group_members.delete({
    where: {
      userId_groupId: { userId: memberId, groupId: groupId }
    }
  });

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
    plan: membership.groups.subscriptions?.[0]?.plans || null
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
    plan: membership.groups.subscriptions?.[0]?.plans || null
  };
  
  return successResponse(res, groupData, 'Active group retrieved successfully');
});

/**
 * Get group statistics
 */
const getGroupStats = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  
  const stats = await prisma.groups.findUnique({
    where: { id: groupId },
    select: {
      creditBalance: true,
      _count: {
        select: {
          group_members: true,
          channels: true,
          conversations: true,
          customers: true
        }
      }
    }
  });
  
  if (!stats) {
    return errorResponse(res, 'Group not found', 404);
  }
  
  return successResponse(res, {
    members: stats._count.group_members,
    channels: stats._count.channels,
    conversations: stats._count.conversations,
    customers: stats._count.customers,
    creditBalance: stats.creditBalance
  }, 'Group statistics retrieved successfully');
});

/**
 * Get group channels
 */
const getGroupChannels = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  
  const channels = await prisma.channels.findMany({
    where: { groupId },
    select: {
      id: true,
      name: true,
      provider: true,
      status: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return successResponse(res, channels, 'Group channels retrieved successfully');
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

/**
 * Request to join a group by owner email
 */
const requestJoinGroup = catchAsync(async (req, res) => {
  const { ownerEmail } = req.body;
  const requester = req.user;

  if (!ownerEmail) {
    return errorResponse(res, 'Owner email is required', 400);
  }

  // Find owner user
  const owner = await prisma.users.findUnique({
    where: { email: ownerEmail }
  });

  if (!owner) {
    return errorResponse(res, 'No user found with this email', 404);
  }

  // Find groups owned by this user
  const ownerGroups = await prisma.groups.findMany({
    where: { creatorId: owner.id },
    include: {
      subscriptions: {
        include: { plans: true }
      },
      _count: {
        select: { group_members: true }
      }
    }
  });

  if (ownerGroups.length === 0) {
    return errorResponse(res, 'This user does not own any groups', 404);
  }

  // For now, send request to join the first group (primary group)
  const targetGroup = ownerGroups[0];

  // Check if user is already a member
  const existingMembership = await prisma.group_members.findUnique({
    where: {
      userId_groupId: {
        userId: requester.id,
        groupId: targetGroup.id
      }
    }
  });

  if (existingMembership) {
    return errorResponse(res, 'You are already a member of this group', 409);
  }

  // Check for existing pending invitation from owner to this user
  const existingInvitation = await prisma.invitations.findFirst({
    where: {
      email: requester.email,
      groupId: targetGroup.id,
      status: 'PENDING'
    }
  });

  if (existingInvitation) {
    return successResponse(res, {
      message: 'You already have a pending invitation to this group',
      invitation: existingInvitation
    }, 'Pending invitation found');
  }

  // Create invitation record as join request (from user perspective)
  const token = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const joinRequest = await prisma.invitations.create({
    data: {
      id: require('crypto').randomUUID(),
      email: requester.email,
      role: 'MEMBER', // Default role for join requests
      token,
      status: 'PENDING',
      expiresAt,
      groupId: targetGroup.id,
      invitedById: requester.id, // Self-initiated
      createdAt: new Date()
    },
    include: {
      groups: true
    }
  });

  // Send notification email to owner
  await invitationService.sendJoinRequestEmail(targetGroup, requester);

  return successResponse(res, {
    joinRequest: {
      id: joinRequest.id,
      groupName: targetGroup.name,
      ownerEmail: owner.email,
      status: joinRequest.status,
      createdAt: joinRequest.createdAt
    },
    message: 'Join request sent to group owner'
  }, 'Join request submitted successfully', 201);
});

/**
 * Get pending join requests for groups owned by user
 */
const getJoinRequests = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Get all groups owned by user
  const ownedGroups = await prisma.groups.findMany({
    where: { creatorId: userId },
    select: { id: true }
  });

  const groupIds = ownedGroups.map(g => g.id);

  // Get all pending invitations where invitedById equals the requester
  // (self-initiated join requests)
  const joinRequests = await prisma.invitations.findMany({
    where: {
      groupId: { in: groupIds },
      status: 'PENDING'
    },
    include: {
      groups: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true
        }
      },
      users: {
        select: {
          id: true,
          email: true,
          userName: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Separate into invitations sent by owner vs join requests from users
  const sentInvitations = joinRequests.filter(req => req.invitedById === userId);
  const receivedRequests = joinRequests.filter(req => req.invitedById !== userId);

  return successResponse(res, {
    sentInvitations,
    receivedRequests,
    total: joinRequests.length
  }, 'Join requests retrieved successfully');
});

/**
 * Approve join request
 */
const approveJoinRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  const ownerId = req.user.id;

  const joinRequest = await prisma.invitations.findUnique({
    where: { id: requestId },
    include: {
      groups: true
    }
  });

  if (!joinRequest) {
    return errorResponse(res, 'Join request not found', 404);
  }

  // Verify user is owner of the group
  if (joinRequest.groups.creatorId !== ownerId) {
    return errorResponse(res, 'Only group owner can approve join requests', 403);
  }

  if (joinRequest.status !== 'PENDING') {
    return errorResponse(res, 'This request has already been processed', 400);
  }

  // Find user by email
  const user = await prisma.users.findUnique({
    where: { email: joinRequest.email }
  });

  if (!user) {
    return errorResponse(res, 'User not found', 404);
  }

  // Create membership and update invitation status
  await prisma.$transaction(async (tx) => {
    // Create group member
    await tx.group_members.create({
      data: {
        id: require('crypto').randomUUID(),
        userId: user.id,
        groupId: joinRequest.groupId,
        role: joinRequest.role,
        canBeAssigned: true,
        assignmentWeight: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Update invitation status
    await tx.invitations.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' }
    });
  });

  return successResponse(res, {
    message: 'User added to group successfully'
  }, 'Join request approved');
});

/**
 * Reject join request
 */
const rejectJoinRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  const ownerId = req.user.id;

  const joinRequest = await prisma.invitations.findUnique({
    where: { id: requestId },
    include: {
      groups: true
    }
  });

  if (!joinRequest) {
    return errorResponse(res, 'Join request not found', 404);
  }

  // Verify user is owner of the group
  if (joinRequest.groups.creatorId !== ownerId) {
    return errorResponse(res, 'Only group owner can reject join requests', 403);
  }

  if (joinRequest.status !== 'PENDING') {
    return errorResponse(res, 'This request has already been processed', 400);
  }

  // Update invitation status
  await prisma.invitations.update({
    where: { id: requestId },
    data: { status: 'DECLINED' }
  });

  return successResponse(res, null, 'Join request rejected');
});

module.exports = {
  createFirstGroup,
  createGroup,
  getUserGroups,
  getGroupById,
  getGroupStats,
  getGroupChannels,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  leaveGroup,
  switchActiveGroup,
  getActiveGroup,
  requestJoinGroup,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
};

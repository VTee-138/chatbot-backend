/**
 * Group Context Middleware
 * Tự động set active group context cho các API requests
 */

const prisma = require('../config/database');
const { errorResponse } = require('../utils/response');

/**
 * Middleware để inject group context vào request
 * Sử dụng cho các endpoint cần biết user đang làm việc với group nào
 */
const injectGroupContext = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(); // Không có user, bỏ qua
    }

    // Lấy active group từ cookie
    const activeGroupCookie = req.cookies.activeGroup;
    
    if (activeGroupCookie) {
      try {
        const activeGroup = JSON.parse(activeGroupCookie);
        
        // Verify group context vẫn valid
        const membership = await prisma.group_members.findUnique({
          where: {
            userId_groupId: { userId, groupId: activeGroup.id }
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

        if (membership) {
          req.groupContext = {
            groupId: membership.groups.id,
            groupName: membership.groups.name,
            userRole: membership.role,
            canBeAssigned: membership.canBeAssigned,
            plan: membership.groups.subscriptions?.plans,
            creditBalance: membership.groups.creditBalance
          };
        }
      } catch (parseError) {
        console.log('Invalid activeGroup cookie:', parseError.message);
        // Clear invalid cookie
        res.clearCookie('activeGroup');
      }
    }

    // Nếu không có active group, lấy group đầu tiên của user
    if (!req.groupContext) {
      const firstMembership = await prisma.group_members.findFirst({
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

      if (firstMembership) {
        req.groupContext = {
          groupId: firstMembership.groups.id,
          groupName: firstMembership.groups.name,
          userRole: firstMembership.role,
          canBeAssigned: firstMembership.canBeAssigned,
          plan: firstMembership.groups.subscriptions?.plans,
          creditBalance: firstMembership.groups.creditBalance
        };
      }
    }

    next();
  } catch (error) {
    console.error('Group context middleware error:', error);
    next(); // Continue without group context
  }
};

/**
 * Middleware bắt buộc phải có group context
 * Sử dụng cho các endpoint cần thiết phải có group
 */
const requireGroupContext = (req, res, next) => {
  if (!req.groupContext) {
    return errorResponse(res, 'No active group. Please create or select a group first.', 400);
  }
  next();
};

/**
 * Middleware check quyền trong group
 * @param {string[]} allowedRoles - Danh sách roles được phép
 */
const requireGroupRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.groupContext) {
      return errorResponse(res, 'No group context found', 400);
    }

    const userRole = req.groupContext.userRole;
    if (!allowedRoles.includes(userRole)) {
      return errorResponse(res, `Access denied. Required roles: ${allowedRoles.join(', ')}`, 403);
    }

    next();
  };
};

/**
 * Middleware check plan limits
 * @param {string} feature - Feature name to check
 * @param {string} limitField - Plan field to check against
 */
const checkPlanLimit = (feature, limitField) => {
  return async (req, res, next) => {
    try {
      if (!req.groupContext || !req.groupContext.plan) {
        return errorResponse(res, 'Plan information not available', 400);
      }

      const plan = req.groupContext.plan;
      const currentUsage = await getCurrentUsage(req.groupContext.groupId, feature);
      const limit = plan[limitField];

      if (currentUsage >= limit) {
        return errorResponse(res, 
          `${feature} limit exceeded. Your ${plan.name} plan allows ${limit} ${feature.toLowerCase()}.`, 
          403
        );
      }

      req.planInfo = {
        feature,
        currentUsage,
        limit,
        remaining: limit - currentUsage
      };

      next();
    } catch (error) {
      console.error('Plan limit check error:', error);
      return errorResponse(res, 'Failed to check plan limits', 500);
    }
  };
};

/**
 * Helper function để lấy usage hiện tại
 */
const getCurrentUsage = async (groupId, feature) => {
  switch (feature) {
    case 'members':
      return await prisma.group_members.count({
        where: { groupId }
      });
    
    case 'channels':
      return await prisma.channels.count({
        where: { groupId }
      });
    
    case 'conversations':
      return await prisma.conversations.count({
        where: { groupId }
      });
    
    default:
      return 0;
  }
};

/**
 * Middleware để log group activities
 */
const logGroupActivity = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Log activity nếu response thành công
      if (res.statusCode >= 200 && res.statusCode < 300 && req.groupContext) {
        console.log(`Group Activity: ${action} in group ${req.groupContext.groupName} by user ${req.user?.userName || req.user?.email}`);
        
        // Có thể lưu vào database để audit trail
        // await logActivityToDatabase(req.user.id, req.groupContext.groupId, action);
      }
      
      originalSend.call(this, body);
    };
    
    next();
  };
};

module.exports = {
  injectGroupContext,
  requireGroupContext,
  requireGroupRole,
  checkPlanLimit,
  logGroupActivity,
  getCurrentUsage
};
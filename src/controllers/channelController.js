const prisma = require("../config/database");

/**
 * Get channel by ID
 * GET /api/v1/channels/:channelId
 */
exports.getChannelById = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.userId;

    // Verify user has access to this channel's group
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      include: {
        groups: {
          include: {
            group_members: {
              where: { userId }
            }
          }
        }
      }
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    if (channel.groups.group_members.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this channel'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: channel.id,
        name: channel.name,
        provider: channel.provider,
        providerChannelId: channel.providerChannelId,
        status: channel.status,
        groupId: channel.groupId,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching channel:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch channel',
      error: error.message
    });
  }
};

/**
 * Get conversations for a specific channel
 * GET /api/v1/channels/:channelId/conversations
 */
exports.getChannelConversations = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      status = 'OPEN',
      search = ''
    } = req.query;

    // Verify user has access to this channel's group
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      include: {
        groups: {
          include: {
            group_members: {
              where: { userId }
            }
          }
        }
      }
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    if (channel.groups.group_members.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this channel'
      });
    }

    // Build where clause
    const where = {
      channelId,
      ...(status && status !== 'ALL' && { status })
    };

    // If search provided, search in customer names
    if (search) {
      where.customers = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } }
        ]
      };
    }

    // Get total count
    const total = await prisma.conversations.count({ where });

    // Get conversations with pagination
    const conversations = await prisma.conversations.findMany({
      where,
      include: {
        customers: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            email: true,
            avatarUrl: true
          }
        },
        group_members: {
          select: {
            id: true,
            users: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            messageType: true,
            direction: true,
            createdAt: true
          }
        }
      },
      orderBy: { lastMessageAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // Format response
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      status: conv.status,
      customer: conv.customers,
      assignee: conv.group_members ? {
        id: conv.group_members.id,
        user: conv.group_members.users
      } : null,
      lastMessage: conv.messages[0] || null,
      lastMessageAt: conv.lastMessageAt,
      chatbotEnabled: conv.chatbotEnabled,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        conversations: formattedConversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching channel conversations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
};

/**
 * Update channel status
 * PATCH /api/v1/channels/:channelId/status
 */
exports.updateChannelStatus = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;

    // Validate status
    const validStatuses = ['ACTIVE', 'INACTIVE', 'PENDING', 'ERROR'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Verify user has admin access to this channel's group
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      include: {
        groups: {
          include: {
            group_members: {
              where: {
                userId,
                role: { in: ['ADMIN', 'OWNER'] }
              }
            }
          }
        }
      }
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    if (channel.groups.group_members.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this channel'
      });
    }

    // Update channel status
    const updatedChannel = await prisma.channels.update({
      where: { id: channelId },
      data: {
        status,
        updatedAt: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Channel status updated successfully',
      data: {
        id: updatedChannel.id,
        status: updatedChannel.status,
        updatedAt: updatedChannel.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating channel status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update channel status',
      error: error.message
    });
  }
};

/**
 * Get channel statistics
 * GET /api/v1/channels/:channelId/stats
 */
exports.getChannelStats = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.userId;

    // Verify user has access to this channel's group
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      include: {
        groups: {
          include: {
            group_members: {
              where: { userId }
            }
          }
        }
      }
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    if (channel.groups.group_members.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this channel'
      });
    }

    // Get conversation statistics
    const [
      totalConversations,
      openConversations,
      closedConversations,
      needsAttention,
      totalMessages
    ] = await Promise.all([
      prisma.conversations.count({
        where: { channelId }
      }),
      prisma.conversations.count({
        where: { channelId, status: 'OPEN' }
      }),
      prisma.conversations.count({
        where: { channelId, status: 'CLOSED' }
      }),
      prisma.conversations.count({
        where: { channelId, status: 'NEEDS_HUMAN_ATTENTION' }
      }),
      prisma.messages.count({
        where: {
          conversations: { channelId }
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        channelId,
        totalConversations,
        openConversations,
        closedConversations,
        needsAttention,
        totalMessages
      }
    });
  } catch (error) {
    console.error('Error fetching channel stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch channel statistics',
      error: error.message
    });
  }
};
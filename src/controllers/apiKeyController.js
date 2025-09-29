const { successResponse, errorResponse, paginatedResponse, catchAsync } = require('../utils/response');
const { generateApiKey, hashApiKey } = require('../utils/crypto');
const config = require('../config');
const prisma = require('../config/database');

/**
 * Create new API key
 */
const createApiKey = catchAsync(async (req, res) => {
  const { name, groupId, permissions, rateLimit, expiresAt } = req.body;
  
  // Generate API key
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  
  // Create API key record
  const apiKeyRecord = await prisma.apiKey.create({
    data: {
      name,
      key: apiKey,
      keyHash,
      permissions,
      rateLimit: rateLimit || config.RATE_LIMIT_MAX_REQUESTS,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      userId: req.user.id,
      groupId: groupId || null,
    },
    select: {
      id: true,
      name: true,
      key: true, // Only include the plain key in creation response
      permissions: true,
      rateLimit: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
      group: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
  
  return successResponse(res, apiKeyRecord, 'API key created successfully', 201);
});

/**
 * Get user's API keys
 */
const getUserApiKeys = catchAsync(async (req, res) => {
  const { page = 1, limit = config.DEFAULT_PAGE_SIZE, groupId } = req.query;
  
  const skip = (page - 1) * limit;
  const where = {
    userId: req.user.id,
    ...(groupId && { groupId }),
  };
  
  const [apiKeys, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      skip,
      take: parseInt(limit),
      select: {
        id: true,
        name: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastUsed: true,
        createdAt: true,
        expiresAt: true,
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        // Don't include the actual key or keyHash for security
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.apiKey.count({ where }),
  ]);
  
  return paginatedResponse(res, apiKeys, total, parseInt(page), parseInt(limit));
});

/**
 * Get group API keys
 */
const getGroupApiKeys = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = config.DEFAULT_PAGE_SIZE } = req.query;
  
  const skip = (page - 1) * limit;
  
  const [apiKeys, total] = await Promise.all([
    prisma.apiKey.findMany({
      where: { groupId: id },
      skip,
      take: parseInt(limit),
      select: {
        id: true,
        name: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastUsed: true,
        createdAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.apiKey.count({ where: { groupId: id } }),
  ]);
  
  return paginatedResponse(res, apiKeys, total, parseInt(page), parseInt(limit));
});

/**
 * Get API key by ID
 */
const getApiKeyById = catchAsync(async (req, res) => {
  const { apiKeyId } = req.params;
  
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId: req.user.id, // Ensure user owns this API key
    },
    select: {
      id: true,
      name: true,
      permissions: true,
      rateLimit: true,
      isActive: true,
      lastUsed: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      group: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
  
  if (!apiKey) {
    return errorResponse(res, 'API key not found', 404);
  }
  
  return successResponse(res, apiKey, 'API key retrieved successfully');
});

/**
 * Update API key
 */
const updateApiKey = catchAsync(async (req, res) => {
  const { apiKeyId } = req.params;
  const { name, permissions, rateLimit, isActive, expiresAt } = req.body;
  
  const updatedApiKey = await prisma.apiKey.update({
    where: {
      id: apiKeyId,
      userId: req.user.id, // Ensure user owns this API key
    },
    data: {
      name,
      permissions,
      rateLimit,
      isActive,
      expiresAt: expiresAt ? new Date(expiresAt) : null,

    },
    select: {
      id: true,
      name: true,
      permissions: true,
      rateLimit: true,
      isActive: true,
      lastUsed: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      group: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
  
  return successResponse(res, updatedApiKey, 'API key updated successfully');
});

/**
 * Regenerate API key
 */
const regenerateApiKey = catchAsync(async (req, res) => {
  const { apiKeyId } = req.params;
  
  // Generate new API key
  const newApiKey = generateApiKey();
  const newKeyHash = hashApiKey(newApiKey);
  
  const updatedApiKey = await prisma.apiKey.update({
    where: {
      id: apiKeyId,
      userId: req.user.id, // Ensure user owns this API key
    },
    data: {
      key: newApiKey,
      keyHash: newKeyHash,
    },
    select: {
      id: true,
      name: true,
      key: true, // Include the new key in response
      permissions: true,
      rateLimit: true,
      isActive: true,
      lastUsed: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      group: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
  
  return successResponse(res, updatedApiKey, 'API key regenerated successfully');
});

/**
 * Delete API key
 */
const deleteApiKey = catchAsync(async (req, res) => {
  const { apiKeyId } = req.params;
  
  await prisma.apiKey.delete({
    where: {
      id: apiKeyId,
      userId: req.user.id, // Ensure user owns this API key
    },
  });
  
  return successResponse(res, null, 'API key deleted successfully');
});

/**
 * Get API key usage statistics
 */
const getApiKeyUsage = catchAsync(async (req, res) => {
  const { apiKeyId } = req.params;
  
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId: req.user.id,
    },
    select: {
      id: true,
      name: true,
      rateLimit: true,
      lastUsed: true,
      createdAt: true,
      isActive: true,
    },
  });
  
  if (!apiKey) {
    return errorResponse(res, 'API key not found', 404);
  }
  
  // TODO: Implement actual usage tracking with Redis or database
  // For now, return basic information
  const usage = {
    apiKey,
    currentPeriodRequests: 0, // Would come from usage tracking system
    rateLimit: apiKey.rateLimit,
    resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  };
  
  return successResponse(res, usage, 'API key usage retrieved successfully');
});

module.exports = {
  createApiKey,
  getUserApiKeys,
  getGroupApiKeys,
  getApiKeyById,
  updateApiKey,
  regenerateApiKey,
  deleteApiKey,
  getApiKeyUsage,
};

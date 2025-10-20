const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./index');

let io;

// Enhanced logging utilities
const SocketLogger = {
  info: (type, message, data = null) => {
    const timestamp = new Date().toISOString();
    const icon = {
      'connect': '🔌',
      'disconnect': '❌',
      'auth': '🔐',
      'join': '📥',
      'leave': '📤',
      'message': '💬',
      'emit': '📡',
      'typing': '⌨️',
      'read': '📖',
      'error': '🔴',
      'success': '✅',
      'warning': '⚠️'
    }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${icon} [Socket ${type.toUpperCase()}] ${message}`);
    if (data) {
      console.log(`    └─ Data:`, JSON.stringify(data, null, 2));
    }
  },

  error: (type, message, error = null) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] 🔴 [Socket ${type.toUpperCase()} ERROR] ${message}`);
    if (error) {
      console.error(`    └─ Error:`, error.message);
      if (error.stack) console.error(`    └─ Stack:`, error.stack);
    }
  },

  // Log current room memberships
  logRooms: (socket, action) => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    console.log(`    └─ ${action} Rooms:`, rooms.join(', ') || 'none');
  },

  // Log active connections count
  logStats: (io) => {
    const socketCount = io.sockets.sockets.size;
    console.log(`    └─ Active connections: ${socketCount}`);
  }
};

/**
 * Initialize Socket.IO server
 * @param {import('http').Server} httpServer - HTTP server instance
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.FRONTEND_URL || 'http://localhost:3001',
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // // Authentication middleware
  // io.use(async (socket, next) => {
  //   try {
  //     const token = socket.handshake.auth.token;

  //     SocketLogger.info('auth', `Authentication attempt from ${socket.id}`);

  //     // ✅ Validate token exists and is a string
  //     if (!token || typeof token !== 'string') {
  //       SocketLogger.error('auth', `Invalid token format: ${typeof token}`);
  //       return next(new Error('Authentication error: No valid token provided'));
  //     }

  //     // Verify JWT token
  //     const decoded = jwt.verify(token, config.JWT_SECRET);
  //     socket.userId = decoded.userId;
  //     socket.userEmail = decoded.email;

  //     SocketLogger.info('auth', `User authenticated successfully`, {
  //       socketId: socket.id,
  //       userId: socket.userId,
  //       email: socket.userEmail
  //     });
  //     next();
  //   } catch (error) {
  //     SocketLogger.error('auth', `Token verification failed`, error);
  //     next(new Error('Authentication error: Invalid token'));
  //   }
  // });

  // Connection handler
  io.on('connection', (socket) => {
    SocketLogger.info('connect', `New client connected`, {
      socketId: socket.id,
      userId: socket.userId,
      email: socket.userEmail
    });
    SocketLogger.logStats(io);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);
    SocketLogger.info('join', `User auto-joined personal room: user_${socket.userId}`);
    SocketLogger.logRooms(socket, 'Current');

    // Join group rooms based on user's groups
    socket.on('join_group', (groupId) => {
      try {
        if (!groupId) {
          SocketLogger.error('join', 'join_group called without groupId');
          socket.emit('error', {
            event: 'join_group',
            message: 'groupId is required'
          });
          return;
        }

        const roomName = `group_${groupId}`;
        socket.join(roomName);
        SocketLogger.info('join', `User joined group`, {
          userId: socket.userId,
          groupId,
          roomName
        });
        SocketLogger.logRooms(socket, 'Current');

        // Acknowledge
        socket.emit('joined_group', { groupId, success: true });
      } catch (error) {
        SocketLogger.error('join', `Failed to join group ${groupId}`, error);
        socket.emit('error', {
          event: 'join_group',
          message: 'Failed to join group',
          error: error.message
        });
      }
    });

    // Leave group room
    socket.on('leave_group', (groupId) => {
      try {
        if (!groupId) {
          SocketLogger.error('leave', 'leave_group called without groupId');
          return;
        }

        const roomName = `group_${groupId}`;
        socket.leave(roomName);
        SocketLogger.info('leave', `User left group`, {
          userId: socket.userId,
          groupId,
          roomName
        });
        SocketLogger.logRooms(socket, 'Remaining');
      } catch (error) {
        SocketLogger.error('leave', `Failed to leave group ${groupId}`, error);
      }
    });

    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
      try {
        if (!conversationId) {
          SocketLogger.error('join', 'join_conversation called without conversationId');
          socket.emit('error', {
            event: 'join_conversation',
            message: 'conversationId is required'
          });
          return;
        }

        const roomName = `conversation_${conversationId}`;
        socket.join(roomName);
        SocketLogger.info('join', `User joined conversation`, {
          userId: socket.userId,
          conversationId,
          roomName
        });
        SocketLogger.logRooms(socket, 'Current');

        // Acknowledge
        socket.emit('joined_conversation', { conversationId, success: true });
      } catch (error) {
        SocketLogger.error('join', `Failed to join conversation ${conversationId}`, error);
        socket.emit('error', {
          event: 'join_conversation',
          message: 'Failed to join conversation',
          error: error.message
        });
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
      try {
        if (!conversationId) {
          SocketLogger.error('leave', 'leave_conversation called without conversationId');
          return;
        }

        const roomName = `conversation_${conversationId}`;
        socket.leave(roomName);
        SocketLogger.info('leave', `User left conversation`, {
          userId: socket.userId,
          conversationId,
          roomName
        });
        SocketLogger.logRooms(socket, 'Remaining');
      } catch (error) {
        SocketLogger.error('leave', `Failed to leave conversation ${conversationId}`, error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      SocketLogger.info('disconnect', `Client disconnected`, {
        socketId: socket.id,
        userId: socket.userId,
        reason
      });
      SocketLogger.logStats(io);
    });

    // Handle errors
    socket.on('error', (error) => {
      SocketLogger.error('error', 'Socket error occurred', error);
    });
  });

  SocketLogger.info('success', 'Socket.IO server initialized successfully');
  return io;
}

/**
 * Get Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized! Call initSocket(httpServer) first.');
  }
  return io;
}

/**
 * Emit new message to conversation room
 * Note: conversationId parameter now receives userId for frontend compatibility
 * Frontend joins room with userId, so we emit to conversation_${userId}
 * @param {string} conversationId - Actually the userId (Zalo user_id) for room matching
 * @param {object} message - Message object
 */
function emitNewMessage(conversationId, message) {
  try {
    if (!conversationId) {
      SocketLogger.error('emit', 'emitNewMessage: conversationId (userId) is required');
      return;
    }

    if (!message) {
      SocketLogger.error('emit', 'emitNewMessage: message is required');
      return;
    }

    const io = getIO();
    const roomName = `conversation_${conversationId}`; // conversationId is actually userId

    SocketLogger.info('emit', `Emitting new_message`, {
      roomName,
      actualUserId: conversationId,
      messageId: message.message_id,
      from: message.from_display_name,
      preview: message.message?.substring(0, 50) + '...'
    });

    io.to(roomName).emit('new_message', message);
    SocketLogger.info('success', `Message emitted to ${roomName} (userId-based room)`);
  } catch (error) {
    SocketLogger.error('emit', 'Failed to emit new message', error);
  }
}

/**
 * Emit conversation update to group
 * @param {string} groupId - Group ID
 * @param {object} conversation - Conversation object
 */
function emitConversationUpdate(groupId, conversation) {
  try {
    if (!groupId) {
      SocketLogger.error('emit', 'emitConversationUpdate: groupId is required');
      return;
    }

    if (!conversation) {
      SocketLogger.error('emit', 'emitConversationUpdate: conversation is required');
      return;
    }

    const io = getIO();
    const roomName = `group_${groupId}`;

    SocketLogger.info('emit', `Emitting conversation_updated`, {
      roomName,
      conversationId: conversation.id,
      lastMessage: conversation.lastMessage?.substring(0, 50) + '...'
    });

    io.to(roomName).emit('conversation_updated', conversation);
    SocketLogger.info('success', `Conversation update emitted to ${roomName}`);
  } catch (error) {
    SocketLogger.error('emit', 'Failed to emit conversation update', error);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitNewMessage,
  emitConversationUpdate,
};

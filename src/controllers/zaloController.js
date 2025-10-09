const { PrismaClient } = require('../../generated/prisma');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const prisma = new PrismaClient();

// Store for PKCE code verifiers (in production, use Redis)
const pkceStore = new Map();

class ZaloController {
  constructor() {
    // Bind all methods to preserve 'this' context
    this.initiateZaloOAuth = this.initiateZaloOAuth.bind(this);
    this.handleZaloCallback = this.handleZaloCallback.bind(this);
    this.handleZaloWebhook = this.handleZaloWebhook.bind(this);
    this.handleIncomingMessage = this.handleIncomingMessage.bind(this);
    this.handleOutgoingMessage = this.handleOutgoingMessage.bind(this);
    this.getZaloAccessToken = this.getZaloAccessToken.bind(this);
    this.refreshTokenByOaId = this.refreshTokenByOaId.bind(this);
    this.refreshAccessToken = this.refreshAccessToken.bind(this);
    this.sendZaloMessage = this.sendZaloMessage.bind(this);
    this.getZaloUsers = this.getZaloUsers.bind(this);
    this.getUserDetail = this.getUserDetail.bind(this);
    this.getConversations = this.getConversations.bind(this);
    this.getAllConversations = this.getAllConversations.bind(this);
    this.listRecentChat = this.listRecentChat.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
  }

  /**
   * Initiate Zalo OA OAuth flow with PKCE
   * GET /api/v1/zalo/connect
   */
  async initiateZaloOAuth(req, res) {
    try {
      const { groupId } = req.query;
      // req.user được giả định là đã có từ middleware xác thực
      const userId = req.user.id;

      if (!groupId) {
        return res.status(400).json({
          success: false,
          message: 'groupId is required',
        });
      }

      // Verify user has access to this group
      const groupMember = await prisma.group_members.findFirst({
        where: {
          groupId: String(groupId), // Đảm bảo kiểu dữ liệu nhất quán
          userId: String(userId),
          role: { in: ['ADMIN', 'OWNER'] }
        }
      });

      if (!groupMember) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to add channels to this group'
        });
      }

      // Generate state and PKCE values
      const state = crypto.randomBytes(16).toString('hex');
      const codeVerifier = crypto.randomBytes(32).toString('hex');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      // IMPROVEMENT: Store the entire context needed in the callback
      pkceStore.set(state, { codeVerifier, groupId, userId });

      // Set expiration (5 minutes)
      setTimeout(() => pkceStore.delete(state), 5 * 60 * 1000);

      // Build Zalo OAuth URL
      const redirectUri = process.env.NODE_ENV === 'production'
        ? process.env.ZALO_REDIRECT_URI_PROD
        : process.env.ZALO_REDIRECT_URI_DEV;

      const authUrl = new URL('https://oauth.zaloapp.com/v4/oa/permission');
      authUrl.searchParams.set('app_id', process.env.ZALO_APP_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      console.log(`🔗 Zalo OAuth URL generated for user ${userId} and group ${groupId}:`, authUrl.toString());

      return res.status(200).json({
        success: true,
        data: {
          authUrl: authUrl.toString(),
          state
        }
      });
    } catch (error) {
      console.error('Error initiating Zalo OAuth:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to initiate Zalo OAuth',
        error: error.message
      });
    }
  }
  async handleZaloCallback(req, res) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    try {
      const { code, state , oa_id} = req.query;
      console.log(req.user);
      const userId = req.user.id;
      if (!code || !state) {
        return res.status(400).json({
          success: false,
          message: 'Missing code or state parameter'
        });
      }

      // FIX #1: Retrieve the whole object from the store, not just the verifier
      const storedData = pkceStore.get(state);
      if (!storedData) {
        throw new Error('Invalid or expired state. Please try connecting again.');
      }
      // Clean up the store immediately after use
      pkceStore.delete(state);

      const { codeVerifier, groupId } = storedData;

      // IMPROVEMENT #1: Use axios data object for urlencoded form
      const tokenResponse = await axios.post(
        'https://oauth.zaloapp.com/v4/oa/access_token',
        {
          grant_type: 'authorization_code',
          app_id: process.env.ZALO_APP_ID, // Use process.env for consistency
          code: code,
          code_verifier: codeVerifier,
          // app_secret is not needed for PKCE flow when getting access token
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'secret_key': process.env.ZALO_APP_SECRET // secret_key is sent via header
          }
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;
      if (!access_token) {
        throw new Error('Failed to retrieve access token from Zalo');
      }

      // Get OA information
      const oaInfoResponse = await axios.get(
        'https://openapi.zalo.me/v2.0/oa/getoa',
        { headers: { 'access_token': access_token } }
      );
      const oaInfo = oaInfoResponse.data.data;
      const oaName = oaInfo.name || `Zalo OA ${oa_id}`;
      const oaAvatar = oaInfo.avatar || null;
      const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000); // 5 mins buffer 
      await prisma.zalo_oa_tokens.upsert({
        where: { oa_id: String(oa_id) },
        update: {
          access_token,
          refresh_token,
          expires_at: expiresAt
        },
        create: {
          oa_id: String(oa_id),
          access_token,
          refresh_token,
          expires_at: expiresAt
        }
      });
      await prisma.zalo_oa_users.create({
        data: {
          oa_id: String(oa_id),
          user_id: String(userId)
        }
      });

      await prisma.channels.create({
        data: {
          id: `zalo_oa_${oa_id}_${Date.now()}`,
          name: oaName,
          provider: 'ZALO',
          providerChannelId: oa_id,
          groupId: groupId,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log(`✅ Zalo OA ${oa_id} successfully connected and linked to group ${groupId} by user ${userId}.`);

      // Redirect back to the frontend with success details
      const redirectUrl = new URL('/settings/channels', frontendUrl); // Or any other relevant page
      redirectUrl.searchParams.set('channel_connected', 'true');
      redirectUrl.searchParams.set('channel_type', 'zalo_oa');
      redirectUrl.searchParams.set('channel_id', oa_id);
      redirectUrl.searchParams.set('channel_name', encodeURIComponent(oaName));
      redirectUrl.searchParams.set('group_id', groupId);

      return res.redirect(redirectUrl.toString());

    } catch (error) {
      console.error('Error handling Zalo callback:', error.response?.data || error.message);

      const redirectUrl = new URL('/settings/channels', frontendUrl);
      redirectUrl.searchParams.set('channel_error', 'true');
      const errorMessage = error.response?.data?.error_description || error.message || 'An unknown error occurred.';
      redirectUrl.searchParams.set('error_message', encodeURIComponent(errorMessage));

      return res.redirect(redirectUrl.toString());
    }
  }


  /**
   * Handle Zalo webhooks
   * POST /api/v1/zalo/webhook
   */
  async handleZaloWebhook(req, res) {
    // Respond immediately to Zalo
    res.status(200).send('OK');

    try {
      const event = req.body;
      const { event_name, oa_id } = event;

      console.log('🔔 Zalo webhook received:', {
        event_name,
        oa_id,
        timestamp: new Date().toISOString()
      });

      // Find the channel by OA ID
      const channel = await prisma.channels.findFirst({
        where: {
          providerChannelId: oa_id,
          provider: 'ZALO'
        }
      });

      if (!channel) {
        console.log('⚠️ Channel not found for OA ID:', oa_id);
        return;
      }

      // Handle different event types
      switch (event_name) {
        case 'user_send_text':
        case 'user_send_image':
        case 'user_send_link':
        case 'user_send_sticker':
        case 'user_send_gif':
          await this.handleIncomingMessage(channel, event);
          break;

        case 'oa_send_text':
        case 'oa_send_image':
          await this.handleOutgoingMessage(channel, event);
          break;

        default:
          console.log('ℹ️ Unhandled event type:', event_name);
      }

    } catch (error) {
      console.error('Error handling Zalo webhook:', error);
    }
  }

  /**
   * Handle incoming message from user
   */
  async handleIncomingMessage(channel, event) {
    const { sender, message, timestamp } = event;
    const userId = sender.id;

    try {
      // Find or create customer
      let customer = await prisma.customers.findFirst({
        where: {
          groupId: channel.groupId,
          customer_identities: {
            some: {
              provider: 'ZALO',
              providerCustomerId: userId
            }
          }
        },
        include: {
          customer_identities: true
        }
      });

      if (!customer) {
        // Create new customer
        customer = await prisma.customers.create({
          data: {
            id: `cust_zalo_${userId}_${Date.now()}`,
            fullName: `Zalo User ${userId.substring(0, 8)}`,
            groupId: channel.groupId,
            createdAt: new Date(),
            customer_identities: {
              create: {
                id: `ident_zalo_${userId}_${Date.now()}`,
                provider: 'ZALO',
                providerCustomerId: userId,
                createdAt: new Date()
              }
            }
          }
        });

        console.log('✅ New customer created:', customer.id);
      }

      // Find or create conversation
      let conversation = await prisma.conversations.findFirst({
        where: {
          channelId: channel.id,
          customerId: customer.id,
          status: { not: 'CLOSED' }
        }
      });

      if (!conversation) {
        conversation = await prisma.conversations.create({
          data: {
            id: `conv_zalo_${Date.now()}`,
            channelId: channel.id,
            customerId: customer.id,
            groupId: channel.groupId,
            status: 'OPEN',
            providerConversationId: `zalo_${channel.providerChannelId}_${userId}`,
            lastMessageAt: new Date(timestamp),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        console.log('✅ New conversation created:', conversation.id);
      }

      // Create message
      let messageContent = '';
      let messageType = 'TEXT';

      if (message.text) {
        messageContent = message.text;
        messageType = 'TEXT';
      } else if (message.attachments) {
        messageContent = JSON.stringify(message.attachments);
        messageType = 'FILE';
      }

      await prisma.messages.create({
        data: {
          id: `msg_zalo_${timestamp}_${Date.now()}`,
          conversationId: conversation.id,
          senderId: userId,
          content: messageContent,
          messageType: messageType,
          direction: 'INCOMING',
          createdAt: new Date(timestamp),
          updatedAt: new Date(timestamp)
        }
      });

      // Update conversation last message time
      await prisma.conversations.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(timestamp) }
      });

      console.log('✅ Message saved:', { conversationId: conversation.id, type: messageType });

    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  /**
   * Handle outgoing message from OA
   */
  async handleOutgoingMessage(channel, event) {
    const { recipient, message, timestamp } = event;
    const userId = recipient.id;

    try {
      // Find customer and conversation
      const customer = await prisma.customers.findFirst({
        where: {
          groupId: channel.groupId,
          customer_identities: {
            some: {
              provider: 'ZALO',
              providerCustomerId: userId
            }
          }
        }
      });

      if (!customer) {
        console.log('⚠️ Customer not found for outgoing message');
        return;
      }

      const conversation = await prisma.conversations.findFirst({
        where: {
          channelId: channel.id,
          customerId: customer.id
        },
        orderBy: { lastMessageAt: 'desc' }
      });

      if (!conversation) {
        console.log('⚠️ Conversation not found for outgoing message');
        return;
      }

      // Save outgoing message
      let messageContent = message.text || JSON.stringify(message);

      await prisma.messages.create({
        data: {
          id: `msg_zalo_out_${timestamp}_${Date.now()}`,
          conversationId: conversation.id,
          content: messageContent,
          messageType: 'TEXT',
          direction: 'OUTGOING',
          createdAt: new Date(timestamp),
          updatedAt: new Date(timestamp)
        }
      });

      console.log('✅ Outgoing message saved');

    } catch (error) {
      console.error('Error handling outgoing message:', error);
    }
  }

  /**
   * Helper: Get Zalo access token for a channel
   * @param {string} channelId - Channel ID (full ID like "zalo_oa_359...1759...")
   * @returns {Promise<string>} Access token
   */
  async getZaloAccessToken(channelId) {
    try {
      // 1. Get channel from database
      const channel = await prisma.channels.findUnique({
        where: { id: channelId }
      });

      if (!channel) {
        throw new Error('Channel not found');
      }

      // 2. Verify it's a Zalo channel
      if (channel.provider !== 'ZALO') {
        throw new Error('Channel is not a Zalo channel');
      }

      // 3. Get Zalo token using providerChannelId (OA ID)
      // ✅ FIX: Use providerChannelId, not full channel.id
      const zaloToken = await prisma.zalo_oa_tokens.findUnique({
        where: { oa_id: channel.providerChannelId }
      });

      if (!zaloToken) {
        throw new Error(`Zalo OA token not found for OA ID: ${channel.providerChannelId}`);
      }

      // 4. Check if token is expired
      const now = new Date();
      if (now >= zaloToken.expires_at) {
        console.log(`⚠️ Access token expired for OA ${channel.providerChannelId}, refreshing...`);
        return await this.refreshTokenByOaId(channel.providerChannelId);
      }

      // 5. Return valid token
      console.log(`✅ Valid access token retrieved for OA ${channel.providerChannelId}`);
      return zaloToken.access_token;

    } catch (error) {
      console.error('❌ Error getting Zalo access token:', error.message);
      throw error;
    }
  }

  /**
   * Helper: Refresh Zalo access token by OA ID
   * @param {string} oaId - Zalo OA ID
   * @returns {Promise<string>} New access token
   */
  async refreshTokenByOaId(oaId) {
    try {
      // Get current token data
      const tokenData = await prisma.zalo_oa_tokens.findUnique({
        where: { oa_id: oaId }
      });

      if (!tokenData) {
        throw new Error(`Token not found for OA ID: ${oaId}`);
      }

      // Call Zalo refresh token API
      const response = await axios.post(
        'https://oauth.zaloapp.com/v4/oa/access_token',
        new URLSearchParams({
          refresh_token: tokenData.refresh_token,
          app_id: process.env.ZALO_APP_ID,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'secret_key': process.env.ZALO_APP_SECRET
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Update token in database
      const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000); // 5 min buffer
      await prisma.zalo_oa_tokens.update({
        where: { oa_id: oaId },
        data: {
          access_token,
          refresh_token,
          expires_at: expiresAt
        }
      });

      console.log(`✅ Access token refreshed successfully for OA ${oaId}`);
      return access_token;

    } catch (error) {
      console.error('Error refreshing Zalo token:', error.response?.data || error.message);
      throw new Error(`Failed to refresh token: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Refresh access token manually (API endpoint)
   * POST /api/v1/zalo/refresh-token
   */
  async refreshAccessToken(req, res) {
    try {
      const { oa_id } = req.body;
      
      if (!oa_id) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing oa_id" 
        });
      }

      // Use helper method to refresh token
      const newAccessToken = await this.refreshTokenByOaId(oa_id);

      // Get updated token data
      const updatedToken = await prisma.zalo_oa_tokens.findUnique({
        where: { oa_id }
      });

      return res.json({
        success: true,
        message: "Access token refreshed successfully",
        data: {
          oa_id: updatedToken.oa_id,
          access_token: newAccessToken,
          expires_at: updatedToken.expires_at
        }
      });

    } catch (error) {
      console.error("Error refreshing Zalo token:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to refresh token"
      });
    }
  }

  /**
   * Send a message via Zalo OA
   * POST /api/v1/zalo/send-message
   */
  async sendZaloMessage(req, res) {
    try {
      const { channelId, userId, message } = req.body;

      // Validate required fields
      if (!channelId || !userId || !message) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: channelId, userId, message'
        });
      }

      // Get channel and verify it exists
      const channel = await prisma.channels.findUnique({
        where: { id: channelId },
        include: {
          groups: {
            include: {
              group_members: {
                where: { userId: req.user.id }
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

      // Verify user has access to this channel's group
      if (!channel.groups.group_members.length) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this channel'
        });
      }

      // Get access token using helper method (with auto-refresh if needed)
      const accessToken = await this.getZaloAccessToken(channelId);

      // Send message to Zalo API
      const response = await axios.post(
        'https://openapi.zalo.me/v3.0/oa/message/cs',
        {
          recipient: {
            user_id: userId
          },
          message: {
            text: message
          }
        },
        {
          headers: {
            'access_token': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Message sent successfully via Zalo:', response.data);

      // Save message to database
      const customer = await prisma.customers.findFirst({
        where: {
          groupId: channel.groupId,
          customer_identities: {
            some: {
              provider: 'ZALO',
              providerCustomerId: userId
            }
          }
        }
      });

      if (customer) {
        const conversation = await prisma.conversations.findFirst({
          where: {
            channelId: channel.id,
            customerId: customer.id
          },
          orderBy: { lastMessageAt: 'desc' }
        });

        if (conversation) {
          await prisma.messages.create({
            data: {
              id: `msg_zalo_out_${Date.now()}`,
              conversationId: conversation.id,
              content: message,
              messageType: 'TEXT',
              direction: 'OUTGOING',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });

          // Update conversation last message time
          await prisma.conversations.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() }
          });
        }
      }

      return res.json({
        success: true,
        message: 'Message sent successfully',
        data: response.data
      });

    } catch (error) {
      console.error('Error sending Zalo message:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * Get list of users following the OA
   * POST /api/v1/zalo/oa/get-users
   */
  async getZaloUsers(req, res) {
    try {
      const { 
        channelId,
        offset = 0,
        count = 15,
        last_interaction_period = 'TODAY',
        is_follower = true
      } = req.body;

      if (!channelId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing channelId' 
        });
      }

      console.log(`👥 Getting users for channel: ${channelId}`);

      // Get access token (with auto-refresh)
      const accessToken = await this.getZaloAccessToken(channelId);

      // Call Zalo API
      const data = {
        offset,
        count,
        last_interaction_period,
        is_follower
      };

      const response = await axios.get('https://openapi.zalo.me/v3.0/oa/user/getlist', {
        headers: { 'access_token': accessToken },
        params: { data: JSON.stringify(data) }
      });

      console.log('✅ Zalo API response:', response.data);

      // ✅ FIX: Return structured data
      return res.json({
        success: true,
        data: response.data.data?.users || [],  // ← Extract users array
        total: response.data.data?.total || 0,
        offset,
        count
      });

    } catch (error) {
      console.error('❌ Error getting Zalo users:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * Get user detail
   * POST /api/v1/zalo/oa/user-detail
   */
  async getUserDetail(req, res) {
    try {
      const { channelId, user_id } = req.body;

      if (!channelId || !user_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing channelId or user_id' 
        });
      }

      console.log(`👤 Getting user detail: ${user_id} for channel: ${channelId}`);

      // Get access token (with auto-refresh)
      const accessToken = await this.getZaloAccessToken(channelId);

      // Call Zalo API
      const data = { user_id };

      const response = await axios.get('https://openapi.zalo.me/v3.0/oa/user/detail', {
        headers: { 'access_token': accessToken },
        params: { data: JSON.stringify(data) }
      });

      console.log('✅ Zalo API response:', response.data);

      // ✅ FIX: Return user data directly
      return res.json({
        success: true,
        data: response.data.data || {}  // ← Extract user object
      });

    } catch (error) {
      console.error('❌ Error getting user detail:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * Get conversation history
   * POST /api/v1/zalo/oa/get-conversations
   */
  async getConversations(req, res) {
    try {
      const { 
        channelId, 
        user_id, 
        offset = 0, 
        count = 5
      } = req.body;

      if (!channelId || !user_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing channelId or user_id' 
        });
      }

      console.log(`💬 Getting conversation history for user: ${user_id}, channel: ${channelId}`);

      // Get access token
      const accessToken = await this.getZaloAccessToken(channelId);

      // Call Zalo API
      const response = await axios.get('https://openapi.zalo.me/v2.0/oa/conversation', {
        headers: { 'access_token': accessToken },
        params: {
          data: JSON.stringify({ 
            offset, 
            count, 
            user_id 
          })
        }
      });

      console.log('✅ Zalo API response:', response.data);

      // ✅ FIX: Return conversation data directly
      return res.json({
        success: true,
        data: response.data.data || [],  // ← Extract conversation array
        offset,
        count
      });

    } catch (error) {
      console.error('❌ Error getting conversations:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * Get ALL conversation history with a user (with auto-pagination)
   * POST /api/v1/zalo/oa/get-all-conversations
   * 
   * This method fetches the complete conversation history by automatically 
   * paginating through all available messages using count=10 (Zalo's max).
   * 
   * Use this when a user first clicks on a conversation to load full context.
   */
  async getAllConversations(req, res) {
    try {
      const { channelId, user_id, forceRefresh = false } = req.body;

      if (!channelId || !user_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing channelId or user_id' 
        });
      }

      console.log(`📚 Fetching ALL conversations for user: ${user_id}, channel: ${channelId}`);

      // Get access token
      const accessToken = await this.getZaloAccessToken(channelId);

      const allMessages = [];
      let offset = 0;
      const count = 10; // Max allowed by Zalo API
      let hasMore = true;
      let pageNumber = 1;

      // Loop until no more messages
      while (hasMore) {
        console.log(`📄 Fetching page ${pageNumber}: offset=${offset}, count=${count}`);

        try {
          const response = await axios.get('https://openapi.zalo.me/v2.0/oa/conversation', {
            headers: { 'access_token': accessToken },
            params: {
              data: JSON.stringify({ offset, count, user_id })
            }
          });

          const messages = response.data?.data || [];
          
          console.log(`✅ Page ${pageNumber}: Received ${messages.length} messages`);

          if (messages.length === 0) {
            // No more messages
            console.log(`🏁 No more messages found. Stopping pagination.`);
            hasMore = false;
            break;
          }

          // Add to collection
          allMessages.push(...messages);

          // Check if this is the last page
          if (messages.length < count) {
            // Less than 10 means this is the last batch
            console.log(`🏁 Last page reached (${messages.length} < ${count})`);
            hasMore = false;
          } else {
            // Move to next page
            offset += count;
            pageNumber++;
          }

          // Safety: prevent infinite loop (max 100 pages = 1000 messages)
          if (offset >= 1000) {
            console.warn('⚠️ Reached safety limit of 1000 messages');
            hasMore = false;
          }

          // Small delay to avoid rate limiting (50ms between requests)
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }

        } catch (error) {
          console.error(`❌ Error fetching page ${pageNumber} at offset ${offset}:`, error.response?.data || error.message);
          hasMore = false;
        }
      }

      console.log(`✅ Total messages fetched: ${allMessages.length} (${pageNumber} pages)`);

      return res.json({
        success: true,
        data: allMessages,
        total: allMessages.length,
        pages: pageNumber,
        user_id
      });

    } catch (error) {
      console.error('❌ Error getting all conversations:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * Get recent chat list
   * POST /api/v1/zalo/oa/list-recent-chat
   */
  async listRecentChat(req, res) {
    try {
      const { 
        channelId, 
        offset = 0, 
        count = 5 
      } = req.body;

      if (!channelId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing channelId' 
        });
      }

      console.log(`📋 Getting recent chats for channel: ${channelId}`);

      // Get access token
      const accessToken = await this.getZaloAccessToken(channelId);

      // Call Zalo API
      const response = await axios.get('https://openapi.zalo.me/v2.0/oa/listrecentchat', {
        headers: { 'access_token': accessToken },
        params: {
          data: JSON.stringify({ offset, count })
        }
      });

      console.log('✅ Zalo API response:', response.data);

      // ✅ FIX: Return only the conversations array, not the whole wrapper
      return res.json({
        success: true,
        data: response.data.data || [],  // ← Extract conversations array
        total: response.data.data?.length || 0,
        offset,
        count
      });

    } catch (error) {
      console.error('❌ Error listing recent chats:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * Send message to user via Zalo OA
   * POST /api/v1/zalo/oa/send-message
   */
  async sendMessage(req, res) {
    try {
      const { channelId, user_id, text } = req.body;

      if (!channelId || !user_id || !text) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing channelId, user_id or text' 
        });
      }

      console.log(`📤 Sending message to user: ${user_id} via channel: ${channelId}`);

      // Get access token
      const accessToken = await this.getZaloAccessToken(channelId);

      // Call Zalo API
      const payload = {
        recipient: { user_id },
        message: { text }
      };

      const response = await axios.post('https://openapi.zalo.me/v3.0/oa/message/cs', payload, {
        headers: {
          'Content-Type': 'application/json',
          'access_token': accessToken
        }
      });

      console.log('✅ Message sent via Zalo:', response.data);

      // ✅ FIX: Return send result directly
      return res.json({
        success: true,
        data: response.data.data || {},  // ← Extract result object
        messageId: response.data.data?.message_id || null
      });

    } catch (error) {
      console.error('❌ Error sending message:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * Get list of users (existing method)
   */
  async getUsers() {
    return "";
  }
}

module.exports = new ZaloController();
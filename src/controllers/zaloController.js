const { PrismaClient } = require('../../generated/prisma');
const axios = require('axios');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Store for PKCE code verifiers (in production, use Redis)
const pkceStore = new Map();

class ZaloController {
  /**
   * Initiate Zalo OA OAuth flow with PKCE
   * GET /api/v1/zalo/connect
   */
  async initiateZaloOAuth(req, res) {
    try {
      const { groupId } = req.query;
      const userId = req.user.userId;

      // Verify user has access to this group
      const groupMember = await prisma.group_members.findFirst({
        where: {
          groupId,
          userId,
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

      // Store code verifier with state and groupId
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

      console.log('🔗 Zalo OAuth URL generated:', authUrl.toString());

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

  /**
   * Handle Zalo OAuth callback
   * GET /api/v1/zalo/callback
   */
  async handleZaloCallback(req, res) {
    try {
      const { code, state, oa_id } = req.query;

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          message: 'Missing code or state parameter'
        });
      }

      // Retrieve stored PKCE data
      const pkceData = pkceStore.get(state);
      if (!pkceData) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired state parameter'
        });
      }

      const { codeVerifier, groupId, userId } = pkceData;
      pkceStore.delete(state); // Use once

      // Exchange code for access token
      const redirectUri = process.env.NODE_ENV === 'production'
        ? process.env.ZALO_REDIRECT_URI_PROD
        : process.env.ZALO_REDIRECT_URI_DEV;

      const tokenResponse = await axios.post(
        'https://oauth.zaloapp.com/v4/oa/access_token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          app_id: process.env.ZALO_APP_ID,
          code: code,
          code_verifier: codeVerifier,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'secret_key': process.env.ZALO_APP_SECRET
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
        {
          headers: {
            'access_token': access_token
          }
        }
      );

      const oaInfo = oaInfoResponse.data.data;
      const oaName = oaInfo.name || `Zalo OA ${oa_id}`;
      const oaAvatar = oaInfo.avatar || null;

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000);

      // Create channel in database
      const channel = await prisma.channels.create({
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

      console.log('✅ Zalo OA connected successfully:', {
        channelId: channel.id,
        oaId: oa_id,
        oaName: oaName
      });

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const redirectUrl = new URL('/dashboard', frontendUrl);
      redirectUrl.searchParams.set('channel_connected', 'true');
      redirectUrl.searchParams.set('channel_id', channel.id);
      redirectUrl.searchParams.set('channel_name', oaName);

      return res.redirect(redirectUrl.toString());

    } catch (error) {
      console.error('Error handling Zalo callback:', error.response?.data || error.message);
      
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const redirectUrl = new URL('/dashboard', frontendUrl);
      redirectUrl.searchParams.set('channel_error', 'true');
      redirectUrl.searchParams.set('error_message', encodeURIComponent(error.message));

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
   * Send a message via Zalo OA
   * POST /api/v1/zalo/send-message
   */
  async sendZaloMessage(req, res) {
    try {
      const { channelId, userId, message } = req.body;

      if (!channelId || !userId || !message) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: channelId, userId, message'
        });
      }

      // Get channel and verify access
      const channel = await prisma.channels.findUnique({
        where: { id: channelId },
        include: {
          groups: {
            include: {
              group_members: {
                where: { userId: req.user.userId }
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

      if (!channel.groups.group_members.length) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this channel'
        });
      }

      // TODO: Retrieve access token from database
      // For now, return error indicating tokens need to be stored
      return res.status(501).json({
        success: false,
        message: 'Token storage not yet implemented. Please store access_token in database first.'
      });

      // Future implementation:
      // const tokenRecord = await prisma.zalo_tokens.findUnique({ where: { channelId } });
      // const response = await axios.post(
      //   'https://openapi.zalo.me/v2.0/oa/message',
      //   {
      //     recipient: { user_id: userId },
      //     message: { text: message }
      //   },
      //   {
      //     headers: { 'access_token': tokenRecord.accessToken }
      //   }
      // );
      // return res.json({ success: true, data: response.data });

    } catch (error) {
      console.error('Error sending Zalo message:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error.message
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
const prisma = require('../../../config/database')
const axios = require('axios');

// Store for PKCE code verifiers (in production, use Redis)
const pkceStore = new Map();

class ZaloMessageController {
    constructor() {
        this.handleZaloWebhook = this.handleZaloWebhook.bind(this);
        this.handleIncomingMessage = this.handleIncomingMessage.bind(this);
        this.handleOutgoingMessage = this.handleOutgoingMessage.bind(this);
        this.sendZaloMessage = this.sendZaloMessage.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.sendZaloImage = this.sendZaloImage.bind(this);
        this.sendZaloFile = this.sendZaloFile.bind(this);
    }

    /**
     * Handle Zalo webhooks
     * POST /api/v1/zalo/webhook
     */
    async handleZaloWebhook(req, res) {
        // Respond immediately to Zalo
        res.status(200).send('OK');
        try {
            const payload = req.body;

            // ✅ LOG FULL PAYLOAD để debug
            console.log('🔔 Zalo webhook RAW PAYLOAD:', JSON.stringify(payload, null, 2));

            // Parse Zalo webhook structure
            // Zalo có thể gửi theo nhiều format khác nhau
            const event_name = payload.event_name;
            const timestamp = payload.timestamp || Date.now();

            // Determine OA_ID based on event type
            let oa_id;
            if (event_name?.startsWith('oa_send_')) {
                // When OA sends message, OA is in sender field
                oa_id = payload.sender?.id;
            } else if (event_name?.startsWith('user_send_')) {
                // When user sends message, OA is in recipient field
                oa_id = payload.recipient?.id;
            } else if (event_name === 'user_received_message') {
                // Delivery confirmation - OA is in sender field
                oa_id = payload.sender?.id;
            } else {
                // Fallback for other events (follow, unfollow, etc.)
                oa_id = payload.oa_id || payload.sender?.id || payload.recipient?.id;
            }

            console.log('📋 Parsed webhook data:', {
                event_name,
                oa_id,
                timestamp,
                has_sender: !!payload.sender,
                has_recipient: !!payload.recipient,
                has_message: !!payload.message,
                sender_id: payload.sender?.id,
                recipient_id: payload.recipient?.id
            });

            if (!oa_id) {
                console.log('⚠️ Missing oa_id in webhook payload');
                // Try to extract from other fields
                if (payload.recipient?.id) {
                    console.log('🔍 Found OA ID in recipient:', payload.recipient.id);
                }
                return;
            }

            // Find the channel by OA ID
            const channel = await prisma.channel.findFirst({
                where: {
                    providerChannelId: String(oa_id),
                    provider: 'ZALO'
                }
            });

            if (!channel) {
                console.log('⚠️ Channel not found for OA ID:', oa_id);
                return;
            }

            console.log('✅ Channel found:', channel.id);

            // Handle different event types
            switch (event_name) {
                case 'user_send_text':
                case 'user_send_image':
                case 'user_send_link':
                case 'user_send_sticker':
                case 'user_send_gif':
                case 'user_send_file':
                case 'user_send_audio':
                case 'user_send_video':
                    console.log('📨 Handling incoming message:', event_name);
                    await this.handleIncomingMessage(channel, payload);
                    break;

                case 'oa_send_text':
                case 'oa_send_image':
                case 'oa_send_gif':
                case 'oa_send_file':
                case 'oa_send_list':
                    console.log('📤 Handling outgoing message:', event_name);
                    await this.handleOutgoingMessage(channel, payload);
                    break;

                case 'user_received_message':
                    console.log('✅ User received message (delivery confirmation)');
                    // This is just a delivery confirmation, no need to save
                    break;

                case 'follow':
                    console.log('👥 User followed OA');
                    // TODO: Handle new follower
                    break;

                case 'unfollow':
                    console.log('👋 User unfollowed OA');
                    // TODO: Handle unfollow
                    break;

                default:
                    console.log('ℹ️ Unhandled event type:', event_name);
            }

        } catch (error) {
            console.error('❌ Error handling Zalo webhook:', error);
        }
    }

    /**
     * Handle incoming message from user
     */
    async handleIncomingMessage(channel, payload) {
        try {
            // Parse Zalo webhook payload
            const { sender, recipient, message, timestamp, event } = payload;
            const userId = sender?.id;
            const messageData = message || event?.message;

            if (!userId) {
                console.log('⚠️ No sender ID in webhook');
                return;
            }

            console.log('📥 Processing incoming message from user:', userId);

            // Find or create customer
            let customer = await prisma.customers.findFirst({
                where: {
                    groupId: channel.groupId,
                    customer_identities: {
                        some: {
                            provider: 'ZALO',
                            providerCustomerId: String(userId)
                        }
                    }
                },
                include: {
                    customer_identities: true
                }
            });

            if (!customer) {
                // Get user info from Zalo API
                let userName = `Zalo User ${String(userId).substring(0, 8)}`;

                try {
                    const accessToken = await this.getZaloAccessToken(channel.id);
                    const userInfoResponse = await axios.get('https://openapi.zalo.me/v3.0/oa/user/detail', {
                        headers: { 'access_token': accessToken },
                        params: { data: JSON.stringify({ user_id: userId }) }
                    });

                    if (userInfoResponse.data?.data?.display_name) {
                        userName = userInfoResponse.data.data.display_name;
                    }
                } catch (error) {
                    console.log('⚠️ Could not fetch user info, using default name');
                }

                // Create new customer
                customer = await prisma.customers.create({
                    data: {
                        id: `cust_zalo_${userId}_${Date.now()}`,
                        fullName: userName,
                        groupId: channel.groupId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        customer_identities: {
                            create: {
                                id: `ident_zalo_${userId}_${Date.now()}`,
                                provider: 'ZALO',
                                providerCustomerId: String(userId)
                            }
                        }
                    }
                });

                console.log('✅ New customer created:', customer.id, userName);
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
                // Convert timestamp to Date properly
                const messageDate = timestamp ? new Date(Number(timestamp)) : new Date();

                conversation = await prisma.conversations.create({
                    data: {
                        id: `conv_zalo_${Date.now()}`,
                        channelId: channel.id,
                        customerId: customer.id,
                        groupId: channel.groupId,
                        status: 'OPEN',
                        providerConversationId: `zalo_${channel.providerChannelId}_${userId}`,
                        lastMessageAt: messageDate,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                });

                console.log('✅ New conversation created:', conversation.id);

                // Emit new conversation to group
                const { emitNewConversation } = require('../config/socket');
                emitNewConversation(channel.groupId, {
                    id: conversation.id,
                    channelId: channel.id,
                    customer: {
                        id: customer.id,
                        fullName: customer.fullName
                    },
                    status: conversation.status,
                    createdAt: conversation.createdAt
                });
            }

            // Parse message content
            let messageContent = '';
            let messageType = 'TEXT';
            let attachments = [];

            if (messageData?.text) {
                messageContent = messageData.text;
                messageType = 'TEXT';
            } else if (messageData?.attachment) {
                messageContent = messageData.attachment.payload?.url || '';
                messageType = this.getMessageTypeFromAttachment(messageData.attachment.type);
                attachments.push(messageData.attachment);
            } else if (messageData?.attachments) {
                messageContent = JSON.stringify(messageData.attachments);
                messageType = 'FILE';
                attachments = messageData.attachments;
            }

            // Convert timestamp to Date properly
            const messageDate = timestamp ? new Date(Number(timestamp)) : new Date();
            const messageId = payload.message_id || `msg_zalo_${timestamp}_${Date.now()}`;

            console.log('📝 Message parsed - NOT saving to DB, emitting via socket only');

            // Update conversation last message time (keep metadata in sync)
            await prisma.conversations.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: messageDate,
                    updatedAt: new Date()
                }
            });

            // Emit message via WebSocket with Zalo-compatible format
            const { emitNewMessage, emitConversationUpdate } = require('../config/socket');

            try {
                // Format message để khớp với ZaloSocketMessage interface ở frontend
                const socketMessage = {
                    message_id: messageId,
                    src: 1, // 1 = from user (customer), 0 = from OA
                    time: messageDate.getTime(),
                    sent_time: messageDate.toISOString(),
                    from_id: String(userId),
                    from_display_name: customer.fullName || 'Unknown User',
                    from_avatar: customer.avatarUrl || '',
                    to_id: channel.providerChannelId, // OA ID
                    to_display_name: channel.name,
                    to_avatar: '',
                    type: messageType.toLowerCase(),
                    message: messageContent,
                    // Include attachment info if present
                    ...(attachments.length > 0 && {
                        attachments: attachments.map(att => ({
                            type: att.type,
                            url: att.payload?.url,
                            name: att.payload?.name
                        }))
                    })
                };

                // Emit to room based on userId (not conversation.id) for frontend compatibility
                console.log('📡 Emitting socket message (NO DB) to userId:', userId);
                emitNewMessage(userId, socketMessage);
                console.log('✅ Socket message emitted successfully (real-time only)');

                // Emit conversation update for inbox list
                console.log('📡 Emitting conversation update to group:', channel.groupId);
                emitConversationUpdate(channel.groupId, {
                    id: conversation.id,
                    channelId: channel.id,
                    customerId: customer.id,
                    customer: {
                        id: customer.id,
                        fullName: customer.fullName,
                        avatarUrl: customer.avatarUrl
                    },
                    lastMessage: messageContent.substring(0, 100),
                    lastMessageAt: messageDate,
                    status: conversation.status,
                    unreadCount: 1 // TODO: Calculate actual unread count
                });
                console.log('✅ Conversation update emitted successfully');

            } catch (socketError) {
                console.error('❌ Error emitting socket events:', socketError);
                // Don't throw - webhook already processed successfully
            }

        } catch (error) {
            console.error('❌ Error handling incoming message:', error);
            console.error('Error stack:', error.stack);

            // Emit error event to monitoring/logging
            try {
                const { emitNotification } = require('../config/socket');
                if (channel.groupId) {
                    emitNotification('system', {
                        type: 'error',
                        title: 'Webhook Processing Error',
                        message: `Failed to process incoming message: ${error.message}`,
                        timestamp: new Date().toISOString(),
                        details: {
                            channelId: channel.id,
                            error: error.message
                        }
                    });
                }
            } catch (notifyError) {
                console.error('❌ Failed to emit error notification:', notifyError);
            }
        }
    }

    /**
     * Helper: Get message type from attachment type
     */
    getMessageTypeFromAttachment(type) {
        const typeMap = {
            'image': 'IMAGE',
            'video': 'VIDEO',
            'audio': 'AUDIO',
            'file': 'FILE',
            'sticker': 'STICKER'
        };
        return typeMap[type?.toLowerCase()] || 'FILE';
    }

    /**
     * Helper: Get attachment type enum
     */
    getAttachmentType(type) {
        const typeMap = {
            'image': 'IMAGE',
            'video': 'VIDEO',
            'audio': 'AUDIO',
            'file': 'FILE',
            'sticker': 'STICKER',
            'location': 'LOCATION',
            'contact': 'CONTACT'
        };
        return typeMap[type?.toLowerCase()] || 'FILE';
    }

    /**
     * Handle outgoing message from OA
     */
    async handleOutgoingMessage(channel, payload) {
        try {
            const { recipient, message, timestamp } = payload;
            const userId = recipient?.id;

            if (!userId) {
                console.log('⚠️ No recipient ID in webhook');
                return;
            }

            console.log('📤 Processing outgoing message to user:', userId);

            // Find or create customer
            let customer = await prisma.customers.findFirst({
                where: {
                    groupId: channel.groupId,
                    customer_identities: {
                        some: {
                            provider: 'ZALO',
                            providerCustomerId: String(userId)
                        }
                    }
                }
            });

            if (!customer) {
                console.log('⚠️ Customer not found, creating new customer for OA outgoing message');

                // Try to fetch user info from Zalo API
                let userName = `Zalo User ${userId.substring(0, 8)}`;
                try {
                    const accessToken = await this.getZaloAccessToken(channel.id);
                    const userInfoResponse = await axios.get(
                        `https://openapi.zalo.me/v3.0/oa/user/detail?data={"user_id":"${userId}"}`,
                        { headers: { access_token: accessToken } }
                    );

                    if (userInfoResponse.data?.data?.display_name) {
                        userName = userInfoResponse.data.data.display_name;
                    }
                } catch (error) {
                    console.log('⚠️ Could not fetch user info, using default name');
                }

                // Create new customer
                customer = await prisma.customers.create({
                    data: {
                        id: `cust_zalo_${userId}_${Date.now()}`,
                        fullName: userName,
                        groupId: channel.groupId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        customer_identities: {
                            create: {
                                id: `ident_zalo_${userId}_${Date.now()}`,
                                provider: 'ZALO',
                                providerCustomerId: String(userId)
                            }
                        }
                    }
                });

                console.log('✅ New customer created for outgoing message:', customer.id, userName);
            }

            // Find or create conversation
            let conversation = await prisma.conversations.findFirst({
                where: {
                    channelId: channel.id,
                    customerId: customer.id
                },
                orderBy: { lastMessageAt: 'desc' }
            });

            if (!conversation) {
                console.log('⚠️ Conversation not found, creating new conversation for outgoing message');

                // Convert timestamp to Date properly
                const messageDate = timestamp ? new Date(Number(timestamp)) : new Date();

                conversation = await prisma.conversations.create({
                    data: {
                        id: `conv_zalo_${Date.now()}`,
                        channelId: channel.id,
                        customerId: customer.id,
                        groupId: channel.groupId,
                        status: 'OPEN',
                        providerConversationId: `zalo_${channel.providerChannelId}_${userId}`,
                        lastMessageAt: messageDate,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                });

                console.log('✅ New conversation created for outgoing message:', conversation.id);

                // Emit new conversation to group
                const { emitNewConversation } = require('../config/socket');
                emitNewConversation(channel.groupId, {
                    id: conversation.id,
                    channelId: channel.id,
                    customer: {
                        id: customer.id,
                        fullName: customer.fullName
                    },
                    status: conversation.status,
                    createdAt: conversation.createdAt
                });
            }

            // Parse message
            const messageContent = message?.text || JSON.stringify(message);

            // Convert timestamp to Date properly
            const messageDate = timestamp ? new Date(Number(timestamp)) : new Date();
            const messageId = payload.message_id || `msg_zalo_out_${timestamp}_${Date.now()}`;

            console.log('📝 Outgoing message parsed - NOT saving to DB, emitting via socket only');

            // Update conversation last message time (keep metadata in sync)
            await prisma.conversations.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: messageDate,
                    updatedAt: new Date()
                }
            });

            // Emit via WebSocket with Zalo-compatible format
            try {
                const { emitNewMessage } = require('../config/socket');

                // Format message để khớp với ZaloSocketMessage interface ở frontend
                const socketMessage = {
                    message_id: messageId,
                    src: 0, // 0 = from OA, 1 = from user
                    time: messageDate.getTime(),
                    sent_time: messageDate.toISOString(),
                    from_id: channel.providerChannelId, // OA ID
                    from_display_name: channel.name,
                    from_avatar: '',
                    to_id: String(userId),
                    to_display_name: customer.fullName || 'Unknown User',
                    to_avatar: customer.avatarUrl || '',
                    type: 'text',
                    message: messageContent
                };

                // Emit to room based on userId (not conversation.id) for frontend compatibility
                console.log('📡 Emitting outgoing message (NO DB) to userId:', userId);
                //emitNewMessage(userId, socketMessage);
                console.log('✅ Outgoing message socket event emitted successfully (real-time only)');

            } catch (socketError) {
                console.error('❌ Error emitting outgoing message socket event:', socketError);
                // Don't throw - message should still be delivered
            }

        } catch (error) {
            console.error('❌ Error handling outgoing message:', error);
            console.error('Error stack:', error.stack);

            // Emit error event
            try {
                const { emitNotification } = require('../config/socket');
                if (channel?.groupId) {
                    emitNotification('system', {
                        type: 'error',
                        title: 'Webhook Processing Error',
                        message: `Failed to process outgoing message: ${error.message}`,
                        timestamp: new Date().toISOString(),
                        details: {
                            channelId: channel.id,
                            error: error.message
                        }
                    });
                }
            } catch (notifyError) {
                console.error('❌ Failed to emit error notification:', notifyError);
            }
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

            // Find customer and conversation for socket emission (NO DB save)
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
                    const messageTimestamp = Date.now();
                    const messageId = response.data.data?.message_id || `msg_zalo_out_${messageTimestamp}`;

                    // Update conversation last message time (keep metadata in sync)
                    await prisma.conversations.update({
                        where: { id: conversation.id },
                        data: { lastMessageAt: new Date() }
                    });

                    console.log('📝 Message NOT saved to DB - emitting via socket only');

                    // Emit socket event for real-time update
                    const { emitNewMessage } = require('../config/socket');

                    // Format message để khớp với ZaloSocketMessage interface
                    const socketMessage = {
                        message_id: messageId,
                        src: 0, // 0 = from OA
                        time: messageTimestamp,
                        sent_time: new Date().toISOString(),
                        from_id: channel.providerChannelId, // OA ID
                        from_display_name: channel.name,
                        from_avatar: '',
                        to_id: userId,
                        to_display_name: customer.fullName || 'Unknown User',
                        to_avatar: customer.avatarUrl || '',
                        type: 'text',
                        message: message
                    };

                    // Emit to room based on userId (not conversation.id) for frontend compatibility
                    console.log('📡 Emitting socket message (NO DB) for sent message to userId:', userId);
                    emitNewMessage(userId, socketMessage);
                    console.log('✅ Socket event emitted (real-time only) to userId:', userId);
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

            // Get channel info
            const channel = await prisma.channels.findUnique({
                where: { id: channelId },
                include: {
                    groups: true
                }
            });

            if (!channel) {
                return res.status(404).json({
                    success: false,
                    message: 'Channel not found'
                });
            }

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

            // Find customer and conversation for socket emission (NO DB save)
            const customer = await prisma.customers.findFirst({
                where: {
                    groupId: channel.groupId,
                    customer_identities: {
                        some: {
                            provider: 'ZALO',
                            providerCustomerId: user_id
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
                    const messageTimestamp = Date.now();
                    const messageId = response.data.data?.message_id || `msg_zalo_out_${messageTimestamp}`;

                    // Update conversation last message time (keep metadata in sync)
                    await prisma.conversations.update({
                        where: { id: conversation.id },
                        data: { lastMessageAt: new Date() }
                    });

                    console.log('📝 Message NOT saved to DB - emitting via socket only');

                    // Emit socket event
                    const { emitNewMessage } = require('../config/socket');

                    // Format message để khớp với ZaloSocketMessage interface
                    const socketMessage = {
                        message_id: messageId,
                        src: 0, // 0 = from OA
                        time: messageTimestamp,
                        sent_time: new Date().toISOString(),
                        from_id: channel.providerChannelId, // OA ID
                        from_display_name: channel.name,
                        from_avatar: '',
                        to_id: user_id,
                        to_display_name: customer.fullName || 'Unknown User',
                        to_avatar: customer.avatarUrl || '',
                        type: 'text',
                        message: text
                    };

                    // Emit to room based on userId (not conversation.id) for frontend compatibility
                    console.log('📡 Emitting socket message (NO DB) for sent message to userId:', user_id);
                    emitNewMessage(user_id, socketMessage);
                    console.log('✅ Socket event emitted (real-time only) to userId:', user_id);
                }
            }

            // Return send result directly
            return res.json({
                success: true,
                data: response.data.data || {},
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
     * Send image via Zalo OA
     * POST /api/v1/zalo/oa/send-image
     * 
     * Sends an image to a user using Zalo's CS Message API.
     * The image must be publicly accessible via HTTPS URL.
     * 
     * @body channelId - Channel ID (required)
     * @body user_id - Zalo user ID (required) 
     * @body imageUrl - Publicly accessible HTTPS image URL (required)
     * @body text - Optional message text to accompany the image
     */
    async sendZaloImage(req, res) {
        try {
            const { channelId, user_id, imageUrl, text } = req.body;

            // Validate required fields
            if (!channelId || !user_id || !imageUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: channelId, user_id, and imageUrl are required',
                });
            }

            // Validate image URL format
            if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                return res.status(400).json({
                    success: false,
                    error: 'imageUrl must be a valid HTTP/HTTPS URL',
                });
            }

            console.log('🖼️ [ZaloMessageController] Sending image:', {
                channelId,
                user_id,
                imageUrl,
                hasText: !!text,
            });

            // Get access token for this channel
            const accessToken = await this.getZaloAccessToken(channelId);

            // Build message payload according to Zalo API v3.0
            const messagePayload = {
                recipient: {
                    user_id: user_id,
                },
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'media',
                            elements: [
                                {
                                    media_type: 'image',
                                    url: imageUrl,
                                },
                            ],
                        },
                    },
                },
            };

            // Add text if provided
            if (text && text.trim()) {
                messagePayload.message.text = text.trim();
            }

            console.log('📤 [ZaloMessageController] Sending to Zalo API:', JSON.stringify(messagePayload, null, 2));

            // Send via Zalo CS Message API
            const response = await axios.post(
                'https://openapi.zalo.me/v3.0/oa/message/cs',
                messagePayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'access_token': accessToken,
                    },
                }
            );

            console.log('✅ [ZaloMessageController] Zalo API response:', response.data);

            // Check if Zalo returned an error
            if (response.data.error !== 0 && response.data.error !== undefined) {
                throw new Error(`Zalo API error: ${response.data.message || 'Unknown error'}`);
            }

            // Emit via socket for real-time update
            try {
                const { emitNewMessage } = require('../config/socket');

                // Find channel and conversation for socket emission
                const channel = await prisma.channels.findUnique({
                    where: { id: channelId },
                });

                if (channel) {
                    const customer = await prisma.customers.findFirst({
                        where: {
                            groupId: channel.groupId,
                            customer_identities: {
                                some: {
                                    provider: 'ZALO',
                                    providerCustomerId: String(user_id),
                                },
                            },
                        },
                    });

                    if (customer) {
                        const conversation = await prisma.conversations.findFirst({
                            where: {
                                channelId: channel.id,
                                customerId: customer.id,
                            },
                            orderBy: { lastMessageAt: 'desc' },
                        });

                        if (conversation) {
                            // Emit socket message in Zalo format
                            emitNewMessage(conversation.id, {
                                message_id: response.data.data?.message_id || `msg_${Date.now()}`,
                                src: 0, // From OA
                                time: Date.now(),
                                sent_time: new Date().toISOString(),
                                from_id: channel.providerChannelId,
                                from_display_name: channel.name,
                                from_avatar: '',
                                to_id: user_id,
                                to_display_name: customer.name || '',
                                to_avatar: '',
                                type: 'image',
                                message: text || '',
                                url: imageUrl,
                            });

                            console.log('✅ [ZaloMessageController] Socket message emitted');
                        }
                    }
                }
            } catch (socketError) {
                console.error('⚠️ [ZaloMessageController] Socket emission failed:', socketError.message);
                // Don't fail the request if socket fails
            }

            return res.json({
                success: true,
                data: response.data,
                imageUrl, // Return the URL for cleanup reference
            });
        } catch (error) {
            console.error('❌ [ZaloMessageController] Error sending image:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to send image',
            });
        }
    }

    /**
     * Send file via Zalo OA
     * POST /api/v1/zalo/oa/send-file
     * 
     * Sends a file to a user using Zalo's CS Message API.
     * The file must be publicly accessible via HTTPS URL.
     * 
     * @body channelId - Channel ID (required)
     * @body user_id - Zalo user ID (required)
     * @body fileUrl - Publicly accessible HTTPS file URL (required)
     * @body text - Optional message text to accompany the file
     */
    async sendZaloFile(req, res) {
        try {
            const { channelId, user_id, fileUrl, text } = req.body;

            // Validate required fields
            if (!channelId || !user_id || !fileUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: channelId, user_id, and fileUrl are required',
                });
            }

            // Validate file URL format
            if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
                return res.status(400).json({
                    success: false,
                    error: 'fileUrl must be a valid HTTP/HTTPS URL',
                });
            }

            console.log('📎 [ZaloMessageController] Sending file:', {
                channelId,
                user_id,
                fileUrl,
                hasText: !!text,
            });

            // Get access token for this channel
            const accessToken = await this.getZaloAccessToken(channelId);

            // Build message payload - files use similar structure to images
            const messagePayload = {
                recipient: {
                    user_id: user_id,
                },
                message: {
                    attachment: {
                        type: 'file',
                        payload: {
                            url: fileUrl,
                        },
                    },
                },
            };

            // Add text if provided
            if (text && text.trim()) {
                messagePayload.message.text = text.trim();
            }

            console.log('📤 [ZaloMessageController] Sending file to Zalo API:', JSON.stringify(messagePayload, null, 2));

            // Send via Zalo CS Message API
            const response = await axios.post(
                'https://openapi.zalo.me/v3.0/oa/message/cs',
                messagePayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'access_token': accessToken,
                    },
                }
            );

            console.log('✅ [ZaloMessageController] Zalo API response:', response.data);

            // Check if Zalo returned an error
            if (response.data.error !== 0 && response.data.error !== undefined) {
                throw new Error(`Zalo API error: ${response.data.message || 'Unknown error'}`);
            }

            // Emit via socket for real-time update
            try {
                const { emitNewMessage } = require('../config/socket');

                const channel = await prisma.channels.findUnique({
                    where: { id: channelId },
                });

                if (channel) {
                    const customer = await prisma.customers.findFirst({
                        where: {
                            groupId: channel.groupId,
                            customer_identities: {
                                some: {
                                    provider: 'ZALO',
                                    providerCustomerId: String(user_id),
                                },
                            },
                        },
                    });

                    if (customer) {
                        const conversation = await prisma.conversations.findFirst({
                            where: {
                                channelId: channel.id,
                                customerId: customer.id,
                            },
                            orderBy: { lastMessageAt: 'desc' },
                        });

                        if (conversation) {
                            emitNewMessage(conversation.id, {
                                message_id: response.data.data?.message_id || `msg_${Date.now()}`,
                                src: 0, // From OA
                                time: Date.now(),
                                sent_time: new Date().toISOString(),
                                from_id: channel.providerChannelId,
                                from_display_name: channel.name,
                                from_avatar: '',
                                to_id: user_id,
                                to_display_name: customer.name || '',
                                to_avatar: '',
                                type: 'file',
                                message: text || '',
                                url: fileUrl,
                            });

                            console.log('✅ [ZaloMessageController] Socket message emitted');
                        }
                    }
                }
            } catch (socketError) {
                console.error('⚠️ [ZaloMessageController] Socket emission failed:', socketError.message);
            }

            return res.json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            console.error('❌ [ZaloMessageController] Error sending file:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to send file',
            });
        }
    }
}

module.exports = new ZaloMessageController();


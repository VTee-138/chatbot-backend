const prisma = require('../../../config/database')
const axios = require('axios');
const conversationModels = require('../models/conversationModels');
const zaloAPIService = require('../../channel/services/zalo/zaloAPIService');
const channelModel = require('../../channel/models/channelModel');
const zaloOauthService = require('../../channel/services/zalo/zaloOauthService');
const { ErrorResponse, getProviderAppKey } = require('../../../utils/constant');
const zaloMessageService = require('../services/zaloMessageService');
const { emitNewMessage, emitConversationUpdate } = require('../../../config/socket');
const fs = require('fs');

class ZaloMessageController {
    constructor() {
        this.handleZaloWebhook = this.handleZaloWebhook.bind(this);
        this.handleIncomingMessage = this.handleIncomingMessage.bind(this);
        this.handleOutgoingMessage = this.handleOutgoingMessage.bind(this);
        this.sendZaloImage = this.sendZaloImage.bind(this);
        this.sendZaloFile = this.sendZaloFile.bind(this);
        this.appId = process.env.ZALO_APP_ID;
        this.appSecret = process.env.ZALO_APP_SECRET
    }

    /**
     * Handle Zalo webhooks
     * POST /api/v1/zalo/webhook
     */

    //     {
    //     "app_id": "360846524940903967",
    //     "sender": {
    //         "id": "246845883529197922"
    //     },
    //     "user_id_by_app": "552177279717587730",
    //     "recipient": {
    //         "id": "388613280878808645"
    //     },
    //     "event_name": "user_send_text",
    //     "message": {
    //         "text": "message",
    //         "msg_id": "96d3cdf3af150460909"
    //     },
    //     "timestamp": "154390853474"
    // }
    async handleZaloWebhook(req, res, next) {
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
            let providerCustomerId;
            if (event_name?.startsWith('oa_send_')) {
                // When OA sends message, OA is in sender field
                oa_id = payload.sender?.id;
                providerCustomerId = payload.recipient?.id;
            } else if (event_name?.startsWith('user_send_')) {
                // When user sends message, OA is in recipient field
                oa_id = payload.recipient?.id;
                providerCustomerId = payload.sender?.id;
            } else if (event_name === 'user_received_message') {
                // Delivery confirmation - OA is in sender field
                oa_id = payload.sender?.id;
                providerCustomerId = payload.recipient?.id;
            } else {
                return;
                // Fallback for other events (follow, unfollow, etc.)
                oa_id = payload.oa_id || payload.sender?.id || payload.recipient?.id;
                providerCustomerId = null;
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

                    await this.handleIncomingMessage(oa_id, providerCustomerId, event_name.replace('user_send_', ''), payload);
                    break;

                case 'oa_send_text':
                case 'oa_send_image':
                case 'oa_send_gif':
                case 'oa_send_file':
                case 'oa_send_list':
                    console.log('📤 Handling outgoing message:', event_name);
                    await this.handleOutgoingMessage(oa_id, providerCustomerId, event_name.replace('oa_send', ''), payload);
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
            next(error);
        }
    }

    /**
     * Handle incoming message from user
     */
    async handleIncomingMessage(providerId, providerCustomerId, messageType, payload) {
        // Parse Zalo webhook payload
        const { sender, recipient, message, timestamp } = payload;
        let messageSentDate = timestamp ? new Date(Number(timestamp)) : new Date();
        let providerMessageId = message.msg_id;

        // Find or create conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                providerCustomerId,
                providerId,
                provider: 'zalo'
            },
            include: {
                customers: true,
            }
        });
        if (!conversation) {
            // Convert timestamp to Date properly
            let randomChannel = await channelModel.getFirstChannel('zalo', providerId);
            let accessToken = zaloOauthService.getValidAccessToken(randomChannel.id, this.appId, this.appSecret)
            let customerData = await zaloAPIService.getZaloUserDetail(accessToken, providerCustomerId)
            conversation = await conversationModels.createZaloConversation(providerId, providerCustomerId, messageSentDate, customerData)

            // // Emit new conversation to group
            // const { emitNewConversation } = require('../config/socket');
            // emitNewConversation(channel.groupId, {
            //     id: conversation.id,
            //     channelId: channel.id,
            //     customer: {
            //         id: customer.id,
            //         fullName: customer.fullName
            //     },
            //     status: conversation.status,
            //     createdAt: conversation.createdAt
            // });
        }
        let checkMessage = await prisma.message.findFirst({
            where: {
                conversationId: conversation.id,
                providerMessageId
            }
        });
        let newMessage = null;
        if (!checkMessage) {
            newMessage = await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderId: providerCustomerId,// 0 là từ OA gửi, 1 là khách gửi
                    senderType: 'human',  // chỉ đặt type cho tin nhắn gửi từ OA
                    src: 1,
                    content: message.text || '',
                    messageType,
                    createdAt: messageSentDate,
                    providerMessageId,
                }
            })
        }

        // Parse message content
        let messageContent = '';
        let attachments = [];
        messageContent = message.text;
        if (message?.attachment) {
            attachments.push(message.attachment)
        }

        // Format message để khớp với ZaloSocketMessage interface ở frontend
        const socketMessage = {
            messageId: payload.message.msg_id,
            src: 1, // 1 = from user (customer), 0 = from OA
            sentTime: messageSentDate.getTime(),
            fromId: providerCustomerId,
            fromDisplayName: conversation.customer.fullName || 'Unknown User',
            fromAvatar: conversation.customer.avatarUrl || '',
            toId: providerId, // OA ID
            toDisplayName: null,
            toAvatar: null,
            type: messageType,
            message: messageContent,
            attachments
        };

        emitNewMessage(userId, socketMessage);
        emitConversationUpdate(channel.groupId, {
            id: conversation.id,
            name: conversation.customers.fullName,
            subtitle: newMessage.content || '---',
            unread: newMessage.src === 1 ? 1 : 0, // src = 1 là từ customer (chưa đọc)
            avatarUrl: conversation.customers.avatarUrl,
            messages: [],
            customerId: conversation.customerId,
            assigneeId: conversation.assigneeId,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            chatbotEnabled: conversation.chatbotEnabled,
            providerConversationId: conversation.providerConversationId,
            lastMessageAt: conversation.lastMessageAt,
            providerAdId: conversation.providerAdId,
            providerCustomerId: conversation.providerCustomerId,
            provider: conversation.provider,
            providerId: conversation.providerId,
            customer: conversation.customers
        });
        console.log('✅ Conversation update emitted successfully');
    }

    /**
     * Handle outgoing message from OA
     */
    async handleOutgoingMessage(providerId, providerCustomerId, messageType, payload) {
        try {
            // Parse Zalo webhook payload
            const { sender, recipient, message, timestamp } = payload;
            let messageSentDate = timestamp ? new Date(Number(timestamp)) : new Date();
            let providerMessageId = message.msg_id;

            // Find or create conversation
            let conversation = await prisma.conversation.findFirst({
                where: {
                    providerCustomerId,
                    providerId,
                    provider: 'zalo'
                },
                include: {
                    customers: true,
                }
            });
            if (!conversation) {
                // Convert timestamp to Date properly
                let randomChannel = await channelModel.getFirstChannel('zalo', providerId);
                let accessToken = zaloOauthService.getValidAccessToken(randomChannel.id, this.appId, this.appSecret)
                let customerData = await zaloAPIService.getZaloUserDetail(accessToken, providerCustomerId)
                conversation = await conversationModels.createZaloConversation(providerId, providerCustomerId, messageSentDate, customerData)

                // // Emit new conversation to group
                // const { emitNewConversation } = require('../config/socket');
                // emitNewConversation(channel.groupId, {
                //     id: conversation.id,
                //     channelId: channel.id,
                //     customer: {
                //         id: customer.id,
                //         fullName: customer.fullName
                //     },
                //     status: conversation.status,
                //     createdAt: conversation.createdAt
                // });
            }
            let checkMessage = await prisma.message.findFirst({
                where: {
                    conversationId: conversation.id,
                    providerMessageId
                }
            });
            let newMessage = null;
            //đoạn này chưa xử lí được tin nhắn do ai gửi
            if (!checkMessage) {
                newMessage = await prisma.message.create({
                    data: {
                        conversationId: conversation.id,
                        senderId: providerCustomerId,// 0 là từ OA gửi, 1 là khách gửi
                        senderType: 'human',  // chỉ đặt type cho tin nhắn gửi từ OA
                        src: 1,
                        content: message.text || '',
                        messageType,
                        createdAt: messageSentDate,
                        providerMessageId,
                    }
                })
            }

            // Parse message content
            let messageContent = '';
            let attachments = [];
            messageContent = message.text;
            if (message?.attachment) {
                attachments.push(message.attachment)
            }

            try {
                // Format message để khớp với ZaloSocketMessage interface ở frontend
                const socketMessage = {
                    messageId: payload.message.msg_id,
                    src: 1, // 1 = from user (customer), 0 = from OA
                    sentTime: messageSentDate.getTime(),
                    fromId: providerId,
                    fromDisplayName: null,
                    fromAvatar: null,
                    toId: providerCustomerId, // OA ID
                    toDisplayName: conversation.customer.fullName || 'Unknown User',
                    toAvatar: conversation.customer.avatarUrl || '',
                    type: messageType,
                    message: messageContent,
                    attachments
                };
                emitNewMessage(userId, socketMessage);
                emitConversationUpdate(channel.groupId, {
                    id: conversation.id,
                    name: conversation.customers.fullName,
                    subtitle: newMessage.content || '---',
                    unread: newMessage.src === 1 ? 1 : 0, // src = 1 là từ customer (chưa đọc)
                    avatarUrl: conversation.customers.avatarUrl,
                    messages: [],
                    customerId: conversation.customerId,
                    assigneeId: conversation.assigneeId,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt,
                    chatbotEnabled: conversation.chatbotEnabled,
                    providerConversationId: conversation.providerConversationId,
                    lastMessageAt: conversation.lastMessageAt,
                    providerAdId: conversation.providerAdId,
                    providerCustomerId: conversation.providerCustomerId,
                    provider: conversation.provider,
                    providerId: conversation.providerId,
                    customer: conversation.customers
                });
                console.log('✅ Conversation update emitted successfully');

            } catch (socketError) {
                throw socketError
            }

        } catch (error) {
            throw error;
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
                        const conversation = await prisma.conversation.findFirst({
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
                        const conversation = await prisma.conversation.findFirst({
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
    async getMessages(req, res, next) {
        try {
            const { conversationId, page = 0, groupId, provider, providerId } = req.query;
            const channel = await channelModel.getGroupChannel(groupId, provider, providerId);
            if (!channel) {
                throw new ErrorResponse('Bạn chưa có quyền để load cuộc trò truyện này', 401);
            }
            const { appId, appSecret } = getProviderAppKey(channel.provider);
            const accessToken = await zaloOauthService.getValidAccessToken(channel.id, appId, appSecret)
            if (!conversationId || !accessToken) {
                return res.status(400).json({
                    error: 1,
                    message: 'Thiếu conversationId hoặc access_token',
                });
            }
            const messages = await zaloMessageService.getMessages(
                conversationId,
                accessToken,
                parseInt(page),
            );

            res.json({
                message: 'Success',
                data: messages,
            });
        } catch (error) {
            next(error)
        }
    }
    async uploadImage(req, res, next) {
        const filePath = req.file?.path;
        const { userId, text } = req.body;
        try {
            const { groupId, provider, providerId } = req.body;
            const channel = await channelModel.getGroupChannel(groupId, provider, providerId);
            if (!channel) {
                throw new ErrorResponse('Bạn chưa có quyền để load cuộc trò truyện này', 401);
            }
            const { appId, appSecret } = getProviderAppKey(channel.provider);
            const accessToken = await zaloOauthService.getValidAccessToken(channel.id, appId, appSecret)
            if (!accessToken) throw new ErrorResponse('Kênh này cần phải được cấp quyền lại', 400);
            if (!filePath) throw new ErrorResponse('Không có file', 400);

            const result = await zaloMessageService.uploadZaloImage(accessToken, filePath, userId, text);
            res.json(result);
        } catch (error) {
            next(error)
        } finally {
            //  Xóa file tạm sau khi xử lý xong (thành công hoặc lỗi)
            if (filePath) fs.unlink(filePath, () => { });
        }
    }

    async uploadFile(req, res, next) {
        const filePath = req.file?.path;
        const { userId } = req.body;
        try {
            const { groupId, provider, providerId } = req.body;
            const channel = await channelModel.getGroupChannel(groupId, provider, providerId);
            if (!channel) {
                throw new ErrorResponse('Bạn chưa có quyền để load cuộc trò truyện này', 401);
            }
            const { appId, appSecret } = getProviderAppKey(channel.provider);
            const accessToken = await zaloOauthService.getValidAccessToken(channel.id, appId, appSecret)
            if (!accessToken) throw new ErrorResponse('Kênh này cần phải được cấp quyền lại', 400);
            if (!filePath) throw new ErrorResponse('Không có file', 400);

            const result = await zaloMessageService.uploadZaloFile(accessToken, filePath, userId);
            res.json(result);
        } catch (error) {
            next(error)
        } finally {
            //  Xóa file tạm
            if (filePath) fs.unlink(filePath, () => { });
        }
    }
}

module.exports = new ZaloMessageController();


const { default: axios } = require('axios');
const prisma = require('../../../config/database'); // Đường dẫn tới Prisma instance
const { ErrorResponse } = require('../../../utils/constant');
const channelModel = require('../../channel/models/channelModel');
const zaloOauthService = require('../../channel/services/zalo/zaloOauthService');
const config = require('../../../config');

const ZALO_IMAGE_URL = 'https://openapi.zalo.me/v2.0/oa/upload/image';
const ZALO_FILE_URL = 'https://openapi.zalo.me/v2.0/oa/upload/file';
const ZALO_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';

class conversationService {
    /**
   * Lấy tin nhắn từ API Zalo
   * @param {string} conversationId id của cuộc hội thoại trong DB
   * @param {string} accessToken token của OA
   * @param {number} page vị trí bắt đầu (1 là mới nhất)
   * @param {number} count số lượng tin nhắn (tối đa 10)
   */
    async getMessages(conversationId, accessToken, page = 1, count = 10) {
        // 🔹 Lấy conversation từ DB
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation || !conversation.providerCustomerId) {
            throw new ErrorResponse('Không tìm thấy hội thoại hoặc providerCustomerId không tồn tại', 400);
        }
        const userId = conversation.providerCustomerId;

        const url = `https://openapi.zalo.me/v2.0/oa/conversation?data=${(
            JSON.stringify({
                user_id: userId,
                offset: Number(page) - 1,
                count,
            })
        )}`;
        const response = await axios.get(url, {
            headers: { access_token: accessToken },
        });

        // Kiểm tra lỗi từ Zalo
        if (response.data.error !== 0) {
            throw new Error(`Zalo API error: ${response.data.message}`);
        }
        const messageList = response.data.data.map(message => {
            return {
                messageId: message.message_id,
                src: message.src, // 1 = from user (customer), 0 = from OA
                sentTime: message.time,
                fromId: message.from_id,
                fromDisplayName: message.from_display_name || 'Unknown User',
                fromAvatar: message.from_avatar || '',
                toId: message.to_id, // OA ID
                toDisplayName: message.to_display_name,
                toAvatar: message.to_avatar,
                type: message.type,
                message: message.message,
            }
        }).reverse();
        return messageList
    }
    /**
     * Send a message via Zalo OA
     * POST /api/v1/zalo/send-message
     */
    async sendZaloMessage(groupId, providerId, userId, message) {

        //@todo validate quyền của user sau 
        //authoriza lun

        // Get access token using helper method (with auto-refresh if needed)
        let channel = await channelModel.getGroupChannel(groupId, 'zalo', providerId);
        let accessToken = await zaloOauthService.getValidAccessToken(channel.id, config.ZALO_APP_ID, config.ZALO_APP_SECRET)

        // Send message to Zalo API
        const response = await axios.post(
            ZALO_MESSAGE_URL,
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
        return response?.data
    }

    /**
     * Upload ảnh lên Zalo OA
     */
    async uploadZaloImage(accessToken, filePath) {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const response = await axios.post(ZALO_IMAGE_URL, form, {
            headers: {
                'access_token': accessToken,
                ...form.getHeaders(),
            },
        });

        const attachmentId = response.data.data.attachment_id;
        const messageBody = {
            recipient: { user_id: userId },
            message: {
                text,
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'media',
                        elements: [
                            {
                                media_type: 'image',
                                attachment_id: attachmentId,
                            },
                        ],
                    },
                },
            },
        };

        const messageResponse = await axios.post(ZALO_MESSAGE_URL, messageBody, {
            headers: {
                'Content-Type': 'application/json',
                access_token: accessToken,
            },
        });

        console.log('✅ Image message sent:', messageResponse.data);
        return {
            message: messageResponse.data,
        };
    }

    /**
     * Upload file (PDF/DOC/DOCX) lên Zalo OA
     */
    async uploadZaloFile(accessToken, filePath) {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const response = await axios.post(ZALO_FILE_URL, form, {
            headers: {
                'access_token': accessToken,
                ...form.getHeaders(),
            },
        });
        const token = response.data.data.token;
        const messageBody = {
            recipient: { user_id: userId },
            message: {
                attachment: {
                    type: 'file',
                    payload: { token },
                },
            },
        };

        const messageResponse = await axios.post(ZALO_MESSAGE_URL, messageBody, {
            headers: {
                'Content-Type': 'application/json',
                access_token: accessToken,
            },
        });

        console.log('✅ File message sent:', messageResponse.data);
        return {
            message: messageResponse.data,
        };
    }

}
module.exports = new conversationService()
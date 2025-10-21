const { default: axios } = require('axios');
const prisma = require('../../../config/database'); // Đường dẫn tới Prisma instance
const { ErrorResponse } = require('../../../utils/constant');

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
}
module.exports = new conversationService()
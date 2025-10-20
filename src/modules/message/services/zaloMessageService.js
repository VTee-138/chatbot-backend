const prisma = require('../../../config/database'); // Đường dẫn tới Prisma instance
const { ErrorResponse } = require('../../../utils/constant');

class conversationService {
    /**
   * Lấy tin nhắn từ API Zalo
   * @param {string} conversationId id của cuộc hội thoại trong DB
   * @param {string} accessToken token của OA
   * @param {number} offset vị trí bắt đầu (0 là mới nhất)
   * @param {number} count số lượng tin nhắn (tối đa 10)
   */
    async getMessages(conversationId, accessToken, offset = 0, count = 10) {
        // 🔹 Lấy conversation từ DB
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation || !conversation.providerCusomerId) {
            throw new ErrorResponse('Không tìm thấy hội thoại hoặc providerCusomerId không tồn tại', 400);
        }

        const userId = conversation.providerCusomerId;

        const url = `https://openapi.zalo.me/v2.0/oa/conversation?data=${encodeURIComponent(
            JSON.stringify({
                user_id: Number(userId),
                offset,
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
        const message = response.data.data;
        return {
            messageId: message.message_id,
            src: message.src, // 1 = from user (customer), 0 = from OA
            sentTime: message.time,
            fromId: message.from_id,
            fromDisplayName: message.from_display_name || 'Unknown User',
            fromAvatar: message.from_avatar || '',
            toId: message.to_id, // OA ID
            toDisplayName: message.to_display_name,
            toAvatar: to_avatar,
            type: message.type,
            message: message.message,
        }
    }
}
module.exports = new conversationService()
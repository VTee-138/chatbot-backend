const axios = require('axios');
const conversationModels = require('../../../message/models/conversationModels');

const ZALO_GET_LIST_USER_URL = 'https://openapi.zalo.me/v3.0/oa/user/getlist';
const MAX_USER_COUNT = 50;

const ZALO_GET_MESSAGES_BY_ID_URL = 'https://openapi.zalo.me/v2.0/oa/conversation';
const MAX_PER_REQUEST = 10;
const MAX_TOTAL = 50;

class ZaloAPIService {
    /**
     * Lấy toàn bộ user trong vòng 30 ngày qua (bao gồm cả hôm nay)
     * @param {string} accessToken token của OA
     */
    async getAllUsers(accessToken) {
        const users = [];
        let offset = 0;

        while (true) {
            const data = {
                offset,
                count: MAX_USER_COUNT,
                // Gộp L30D (30 ngày qua, không gồm hôm nay) + TODAY để lấy cả 31 ngày gần nhất
                last_interaction_period: 'L30D',
                is_follower: true,
            };

            const res = await axios.get(ZALO_GET_LIST_USER_URL, {
                params: { data: JSON.stringify(data) },
                headers: { access_token: accessToken },
            });

            const body = res.data;
            if (body.error !== 0) throw new Error(body.message || 'Zalo API error');

            const fetchedUsers = body.data?.users || [];
            users.push(...fetchedUsers);

            // Nếu ít hơn count thì dừng
            if (fetchedUsers.length < MAX_COUNT) break;

            offset += MAX_COUNT;
            if (offset >= 10000) break; // Giới hạn của API
        }

        // Tiếp tục gọi lần 2 cho "TODAY" để gộp user hôm nay
        const todayRes = await axios.get(ZALO_GET_LIST_USER_URL, {
            params: {
                data: JSON.stringify({
                    offset: 0,
                    count: MAX_COUNT,
                    last_interaction_period: 'TODAY',
                    is_follower: true,
                }),
            },
            headers: { access_token: accessToken },
        });

        const todayUsers = todayRes.data?.data?.users || [];
        // Hợp nhất, loại trùng
        const uniqueUsers = [
            ...new Map(
                [...users, ...todayUsers].map((u) => [u.user_id, u])
            ).values(),
        ];

        return uniqueUsers;
    }
    /**
     * Lấy tối đa 50 tin nhắn giữa OA và 1 user
     * @param {string} accessToken Access token của OA
     * @param {string|number} userId ID của user cần lấy tin nhắn
     */
    async getUserMessages(accessToken, userId) {
        const messages = [];
        const seenIds = new Set();

        let offset = 0;

        while (messages.length < MAX_TOTAL) {
            const count = Math.min(MAX_PER_REQUEST, MAX_TOTAL - messages.length);

            const res = await axios.get(ZALO_GET_MESSAGES_BY_ID_URL, {
                params: {
                    data: JSON.stringify({
                        user_id: userId,
                        offset,
                        count,
                    }),
                },
                headers: {
                    access_token: accessToken,
                },
            });

            const body = res.data;
            if (body.error !== 0) throw new Error(body.message || 'Zalo API error');

            const chunk = body.data || [];
            for (const msg of chunk) {
                if (!seenIds.has(msg.message_id)) {
                    seenIds.add(msg.message_id);
                    messages.push(msg);
                }
            }

            // Nếu ít hơn count, tức là hết tin nhắn
            if (chunk.length < count) break;

            offset += count;
        }

        return messages;
    }

    /**
     * Đồng bộ toàn bộ conversation và message từ Zalo OA
     * @param {string} accessToken access_token của OA
     * @param {string} providerId ID của OA (providerId)
     */
    async syncZaloConversations(accessToken, providerId) {

        //  Lấy danh sách user
        const users = await this.getAllUsers(accessToken);
        const allMessages = [];
        // Duyệt từng user, tạo conversation nếu chưa có
        for (const user of users) {
            let providerCusomerId = user.user_id
            // Kiểm tra conversation đã tồn tại chưa
            let conversation = await prisma.conversation.findFirst({
                where: {
                    provider: 'zalo',
                    providerId,
                    providerCusomerId,
                },
            });

            // Nếu chưa tồn tại thì tạo mới
            if (!conversation) {
                conversation = await conversationModels.createZaloConversation(providerId, providerCusomerId)
            }

            // Lấy tin nhắn của user này
            //khi lấy đã tự động chống trùng r nhen
            const messages = await this.getUserMessages(accessToken, providerCusomerId);
            if (!messages.length) continue;
            //  Chuẩn hóa tin nhắn theo schema Message
            const messageData = messages.map((msg) => ({
                conversationId: conversation.id,
                senderId: msg.src === 1 ? providerCusomerId : providerId,// 0 là từ OA gửi, 1 là khách gửi
                senderType: msg.src === 1 ? null : 'human', // chỉ đặt type cho tin nhắn gửi từ OA
                src: msg.src,
                content: msg.message || '',
                messageType: msg.type || 'text',
                createdAt: new Date(msg.time),
            }));
            //thiêu attachment (....)

            allMessages.push(...messageData);
        }

        //cần phải dùng messageQueue để update kh bị mất data (update sau)
        const BATCH_SIZE = 500;

        for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
            const batch = allMessages.slice(i, i + BATCH_SIZE);
            await prisma.message.createMany({
                data: batch,
            });
        }
    }

}

module.exports = new ZaloAPIService();

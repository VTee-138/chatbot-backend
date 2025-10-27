const axios = require('axios');
const conversationModels = require('../../../message/models/conversationModels');
const prisma = require('../../../../config/database');
const { MessageType } = require('@prisma/client');

const toMessageType = (zaloType) => {
    switch (zaloType) {
        case 'text': return MessageType.text;
        case 'image': return MessageType.image;
        case 'file': return MessageType.file;
        case 'audio': return MessageType.audio;
        case 'video': return MessageType.video;
        case 'sticker': return MessageType.sticker;
        case 'gif': return MessageType.gif;
        case 'location': return MessageType.location;
        default: return MessageType.text; // fallback
    }
};
class ZaloAPIService {
    /**
     * Lấy toàn bộ user trong vòng 30 ngày qua (bao gồm cả hôm nay)
     * @param {string} accessToken token của OA
     */
    async getAllUsers(accessToken) {
        const url = 'https://openapi.zalo.me/v3.0/oa/user/getlist';
        const MAX_USER_COUNT = 50;
        const users = [];
        let offset = 0;
        //tim follower OA trong 30 truoc
        while (true) {
            const data = {
                offset,
                count: MAX_USER_COUNT,
                // Gộp L30D (30 ngày qua, không gồm hôm nay) + TODAY để lấy cả 31 ngày gần nhất
                last_interaction_period: 'L30D',
                is_follower: true,
            };

            const res = await axios.get(url, {
                params: { data: JSON.stringify(data) },
                headers: { access_token: accessToken },
            });

            const body = res.data;
            if (body.error !== 0) throw new Error(body.message || 'Zalo API error');

            const fetchedUsers = body.data?.users || [];
            users.push(...fetchedUsers);

            // Nếu ít hơn count thì dừng
            if (fetchedUsers.length < MAX_USER_COUNT) break;

            offset += MAX_USER_COUNT;
            if (offset >= 10000) break; // Giới hạn của API
        }
        //tim unfollower OA trong 30 ngay truoc
        while (true) {
            const data = {
                offset,
                count: MAX_USER_COUNT,
                // Gộp L30D (30 ngày qua, không gồm hôm nay) + TODAY để lấy cả 31 ngày gần nhất
                last_interaction_period: 'L30D',
                is_follower: false,
            };

            const res = await axios.get(url, {
                params: { data: JSON.stringify(data) },
                headers: { access_token: accessToken },
            });

            const body = res.data;
            if (body.error !== 0) throw new Error(body.message || 'Zalo API error');

            const fetchedUsers = body.data?.users || [];
            users.push(...fetchedUsers);

            // Nếu ít hơn count thì dừng
            if (fetchedUsers.length < MAX_USER_COUNT) break;

            offset += MAX_USER_COUNT;
            if (offset >= 10000) break; // Giới hạn của API
        }

        // Tiếp tục gọi lần 2 cho "TODAY" để gộp user hôm nay
        //da follow
        const todayRes = await axios.get(url, {
            params: {
                data: JSON.stringify({
                    offset: 0,
                    count: MAX_USER_COUNT,
                    last_interaction_period: 'TODAY',
                    is_follower: true,
                }),
            },
            headers: { access_token: accessToken },
        });

        const todayUsers = todayRes.data?.data?.users || [];
        //chua follow
        const todayResUnfollow = await axios.get(url, {
            params: {
                data: JSON.stringify({
                    offset: 0,
                    count: MAX_USER_COUNT,
                    last_interaction_period: 'TODAY',
                    is_follower: false,
                }),
            },
            headers: { access_token: accessToken },
        });

        const todayUsersUnfollow = todayResUnfollow.data?.data?.users || [];
        // Hợp nhất, loại trùng
        const uniqueUsers = [
            ...new Map(
                [...users, ...todayUsers, ...todayUsersUnfollow].map((u) => [u.user_id, u])
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
        const url = 'https://openapi.zalo.me/v2.0/oa/conversation';
        const MAX_PER_REQUEST = 10;
        const MAX_TOTAL = 50;
        const messages = [];
        const seenIds = new Set();

        let offset = 0;

        while (messages.length < MAX_TOTAL) {
            const count = Math.min(MAX_PER_REQUEST, MAX_TOTAL - messages.length);

            const res = await axios.get(url, {
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
    async syncZaloConversations(accessToken, providerId, groupId) {

        //  Lấy danh sách user
        const users = await this.getAllUsers(accessToken);
        const allMessages = [];
        // Duyệt từng user, tạo conversation nếu chưa có

        for (const user of users) {
            let providerCustomerId = user.user_id
            let userDetail = await this.getZaloUserDetail(accessToken, providerCustomerId)
            // Kiểm tra conversation đã tồn tại chưa
            let conversation = await prisma.conversation.findFirst({
                where: {
                    provider: 'zalo',
                    providerId,
                    providerCustomerId,
                },
            });
            if (conversation) {
                await createCustomer(userDetail, groupId);
                continue;
            }

            // Lấy tin nhắn của user này
            //khi lấy đã tự động chống trùng r nhen
            const messages = await this.getUserMessages(accessToken, providerCustomerId);
            const lastMessageAt = messages[0]?.time ? new Date(messages[0]?.time) : new Date();
            // Nếu chưa tồn tại thì tạo mới
            conversation = await conversationModels.createZaloConversation(providerId, providerCustomerId, lastMessageAt, userDetail, groupId)

            if (!messages.length) continue;
            //  Chuẩn hóa tin nhắn theo schema Message
            const messageData = messages.map((msg) => ({
                conversationId: conversation.id,
                senderId: msg.src === 1 ? providerCustomerId : providerId,// 0 là từ OA gửi, 1 là khách gửi
                senderType: msg.src === 1 ? 'human' : 'human', // chỉ đặt type cho tin nhắn gửi từ OA
                src: msg.src,
                content: msg.message || '',
                messageType: toMessageType(msg.type),
                providerMessageId: msg.message_id,
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

    /**

    Lấy thông tin chi tiết người dùng từ Zalo OA API
    @param {string} userId - ID của người dùng Zalo
    @param {string} accessToken - access_token của OA
    @returns {Promise<object|null>} Thông tin chi tiết người dùng hoặc null nếu lỗi
    */
    async getZaloUserDetail(accessToken, userId) {
        const url = 'https://openapi.zalo.me/v3.0/oa/user/detail';
        const response = await axios.get(url, {
            headers: {
                access_token: accessToken,
            },
            params: {
                data: JSON.stringify({ user_id: userId }),
            },
        });

        if (response.data.error === 0) {
            return response.data.data; // Trả về thông tin người dùng
        } else {
            console.log('⚠️ Zalo API error:', response.data.message);
            return null;
        }

    }
}
module.exports = new ZaloAPIService();

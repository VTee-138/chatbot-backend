const { custom } = require('joi');
const prisma = require('../../../config/database'); // Đường dẫn tới Prisma instance

class conversationService {
    async getConversations({ provider, page, isRead, groupId }) {
        let limit = 10;
        const skip = (page - 1) * limit;

        const channels = await prisma.channel.findMany({
            where: {
                groupId,
                ...(provider ? { provider } : {}), // nếu có filter provider thì thêm vào
            },
            select: {
                provider: true,
                providerId: true,
            },
        });

        if (channels.length === 0) {
            return { page, filteredConversations: [] };
        }

        // 🔹 2. Tạo điều kiện where cho conversation theo danh sách channel
        const conversationWhere = {
            OR: channels.map((ch) => ({
                provider: ch.provider,
                providerId: ch.providerId,
            })),
        };

        // 🔹 3. Truy vấn conversations
        const conversations = await prisma.conversation.findMany({
            where: conversationWhere,
            skip,
            take: limit,
            orderBy: { lastMessageAt: "desc" },
            include: {
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1, // chỉ lấy message mới nhất
                    select: { id: true, src: true, content: true, createdAt: true },
                },
                customers: true,
            },
        });

        // 🔹 4. Lọc theo trạng thái đọc (isRead)
        const filteredConversations =
            isRead === undefined
                ? conversations
                : conversations.filter((c) => {
                    const last = c.messages[0];
                    if (!last) return false;
                    return isRead ? last.src === 0 : last.src === 1;
                });

        return {
            page,
            filteredConversations,
        };
    };
    async assertUserInGroup(userId, groupId) {
        const member = await prisma.groupMember.findFirst({
            where: { userId, groupId, status: 'accepted' },
        });

        if (!member) {
            throw new ErrorResponse('Người dùng không thuộc nhóm này', 400);
        }

        return member;
    }
    async getActivePlanByGroup(groupId) {
        const now = new Date();

        const plan = await prisma.groupPlan.findFirst({
            where: {
                groupId,
                startAt: { lt: now },
                expireAt: { gt: now },
            },
            include: {
                plans: {
                    select: {
                        name: true,
                        limits: true,
                    },
                },
            },
        });

        return plan; // null nếu không có plan nào đang hoạt động
    }
}
module.exports = new conversationService()
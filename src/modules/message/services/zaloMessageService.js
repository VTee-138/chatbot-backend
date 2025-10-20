const prisma = require('../../../config/database'); // Đường dẫn tới Prisma instance

class conversationService {
    async getConversations({ provider, page, isRead }) {
        let limit = 10;
        const skip = (page - 1) * limit;

        // Lọc điều kiện cơ bản
        const where = {};
        if (provider) where.provider = provider;

        // Lấy danh sách conversation + message mới nhất
        const conversations = await prisma.conversation.findMany({
            where,
            skip,
            take: limit,
            orderBy: { lastMessageAt: 'desc' },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1, // chỉ lấy message mới nhất
                    select: { id: true, src: true, createdAt: true },
                },
            },
        });

        const filteredConversations = isRead === undefined
            ? conversations
            : conversations.filter(c => {
                const last = c.messages[0];
                if (!last) return false;
                return isRead ? last.src === 0 : last.src === 1;
            });

        // const total = await prisma.conversation.count({ where });

        return {
            page,
            filteredConversations,
        };
    };
}
module.exports = new conversationService()
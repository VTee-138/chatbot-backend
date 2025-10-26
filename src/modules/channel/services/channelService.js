const { GroupRole } = require('@prisma/client');
const prisma = require('../../../config/database');
const { ErrorResponse } = require('../../../utils/constant');

class ChannelService {
    // Check quyền: owner hoặc manager
    async checkUserPermission(groupId, userId) {
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { groupMembers: true },
        });

        if (!group) throw new ErrorResponse('Không tìm thấy group', 400);
        if (group.ownerId === userId) return true;

        const member = group.groupMembers.find(
            (gm) => gm.userId === userId && gm.role === GroupRole.manager
        );

        if (!member) throw new ErrorResponse('Phải là owner hoặc manager để xem', 400);
        return true;
    }

    // Lấy danh sách channel theo groupId
    async getChannelsByGroup(groupId, userId) {
        console.log('Checking permissions for user:', userId, 'on group:', groupId);
        await this.checkUserPermission(groupId, userId);

        const channels = await prisma.channel.findMany({
            where: { groupId: 'bachdh1' },
            select: {
                id: true,
                name: true,
                provider: true,
                providerId: true,
                createdAt: true,
                updatedAt: true,
                status: true,
                createdAt: true,
            }
        });

        return channels;
    }
}

module.exports = new ChannelService();

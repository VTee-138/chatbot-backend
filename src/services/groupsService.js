const prisma = require("../config/database");
const { ErrorResponse, Constants } = require("../utils/constant");
//file này sẽ cần viết thêm DTO để lọc dữ liệu trả về
class GroupsService {
    async acceptInvitation(userId, groupId) {
        const member = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });

        if (!member || member.status !== "pending") {
            throw new ErrorResponse("Lời mời không hợp lệ hoặc đã được xử lý", 400);
        }

        return await prisma.groupMember.update({
            where: { id: member.id },
            data: { status: "accepted" }
        });
    }

    async declineInvitation(userId, groupId) {
        const member = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });

        if (!member || member.status !== "pending") {
            throw new ErrorResponse("Lời mời không hợp lệ hoặc đã được xử lý", 400);
        }

        return await prisma.groupMember.update({
            where: { id: member.id },
            data: { status: "declined" }
        });
    }

    async getMyInvitations(userId) {
        return await prisma.groupMember.findMany({
            where: { userId },
            include: { groups: true },
            orderBy: { createdAt: "desc" }
        });
    }

    async getMyPendingInvitations(userId) {
        const count = await prisma.groupMember.count({
            where: { userId, status: "pending" }
        });
        return { pendingInvitations: count };
    }

    async getGroupInformation(groupId, userId) {
        await this.groupAuthorize(userId, groupId, Constants.GROUP_MEMBER_COMMON_ROLES);

        return await prisma.group.findUnique({
            where: { id: groupId },
        });
    }

    async getGroupMembers(groupId, userId) {
        const member = await this.groupMemberAuthorize(userId, groupId, Constants.GROUP_MEMBER_ADMIN_ROLES);

        const isAdmin = Constants.GROUP_MEMBER_ADMIN_ROLES.includes(member.role);

        return prisma.groupMember.findMany({
            where: {
                groupId,
                ...(isAdmin ? {} : { status: "accepted" })
            },
            include: { users: true }
        });
    }

    async updateRole(userId, groupId, newRole, targetId) {
        const actor = await this.groupMemberAuthorize(userId, groupId, Constants.GROUP_MEMBER_OWNER_ROLES);

        if (newRole === "owner") {
            throw new ErrorResponse("Không thể gán quyền owner", 400);
        }

        return await prisma.groupMember.update({
            where: { userId_groupId: { targetId, groupId } },
            data: { role: newRole }
        });
    }

    async deleteMember(userId, groupId, targetId) {
        const actor = await this.groupMemberAuthorize(userId, groupId, Constants.GROUP_MEMBER_OWNER_ROLES);

        return await prisma.groupMember.delete({
            where: { userId_groupId: { userId: targetId, groupId } },
        });
    }

    async getGroupsByUser(userId) {
        // Lấy tất cả group mà user là thành viên
        const groups = await prisma.group.findMany({
            where: {
                groupMembers: {
                    some: { userId },
                    status: "accepted",
                },
            },
            include: {
                users: true,
                subscriptions: {
                    include: { plans: true }, // gói đăng ký của nhóm
                },
            },
            orderBy: [
                { isActive: 'desc' },
                { createdAt: 'desc' },
            ],
        });

        // Vì Prisma không hỗ trợ orderBy nested aggregate tốt trong 1 query, ta có thể sort thủ công
        const sortedGroups = groups.sort((a, b) => {
            const lastA = a.subscriptions.length
                ? new Date(Math.max(...a.subscriptions.map(s => new Date(s.startedAt || 0))))
                : 0;
            const lastB = b.subscriptions.length
                ? new Date(Math.max(...b.subscriptions.map(s => new Date(s.startedAt || 0))))
                : 0;
            return lastB - lastA;
        });

        return sortedGroups;
    }

    /**
   * Kiểm tra xem group có hợp lệ hay không
   * - Không bị xóa
   * - Đang active
   * - Có subscription còn hạn
   */
    async groupValidation(groupId) {
        const now = new Date()

        const group = await prisma.group.findUnique({
            where: { id: groupId },
            select: {
                isActive: true,
                deletedAt: true,
                subscriptions: {
                    where: {
                        startedAt: { lte: now },
                        expireAt: { gte: now },
                    },
                    select: { id: true },
                },
            },
        })

        if (!group) throw new ErrorResponse('Nhóm không tồn tại', 400);

        if (!group.isActive || group.deletedAt !== null) throw new ErrorResponse('Nhóm đã bị người tạo dừng hoạt động', 400);

        if (group.subscriptions.length === 0) throw new ErrorResponse('Vui lòng hãy mua gói trả phí để có thể tiếp tục', 400);


        return group
    }

    /**
     * Kiểm tra quyền của user trong group
     * - User thuộc group
     * - Có role hợp lệ
     * - Status là accepted
     */
    async groupMemberAuthorize(userId, groupId, roles) {

        // Kiểm tra thành viên
        const member = await prisma.groupMember.findFirst({
            where: {
                userId,
                groupId,
                status: "accepted",
            },
            select: {
                role: true,
                users: {
                    select: { isActive: true },
                },
            },
        })

        if (!member) throw new ErrorResponse('Bạn đang không ở trong nhóm này', 400);
        // Nếu có danh sách roles được yêu cầu thì kiểm tra
        if (roles.length > 0 && !roles.includes(member.role)) {
            throw new ErrorResponse(`Chỉ ${roles} mới có thể thực hiện điều này`, 400);

        }

        return member;
    }
}

module.exports = new GroupsService();

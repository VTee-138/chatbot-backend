const prisma = require("../config/database");
const Constants = require("../utils/constant");
//file này sẽ cần viết thêm DTO để lọc dữ liệu trả về
class GroupsService {
    async acceptInvitation(userId, groupId) {
        const member = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });

        if (!member || member.status !== "pending") {
            throw new Constants.ErrorResponse("Lời mời không hợp lệ hoặc đã được xử lý", 400);
        }

        return prisma.groupMember.update({
            where: { id: member.id },
            data: { status: "accepted" }
        });
    }

    async declineInvitation(userId, groupId) {
        const member = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });

        if (!member || member.status !== "pending") {
            throw new Constants.ErrorResponse("Lời mời không hợp lệ hoặc đã được xử lý", 400);
        }

        return prisma.groupMember.update({
            where: { id: member.id },
            data: { status: "declined" }
        });
    }

    async getMyInvitations(userId) {
        return prisma.groupMember.findMany({
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
        const isMember = await this.groupAuthorize(userId, groupId);

        if (!isMember) {
            throw new Constants.ErrorResponse("Bạn không thuộc nhóm này", 403);
        }

        return prisma.group.findUnique({
            where: { id: groupId },
            include: { groupMembers: true }
        });
    }

    async getGroupMembers(groupId, userId) {
        const isMember = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });

        if (!isMember) {
            throw new Constants.ErrorResponse("Không có quyền truy cập nhóm này", 403);
        }

        return prisma.groupMember.findMany({
            where: { groupId },
            include: { users: true }
        });
    }

    async updateRole(userId, groupId, newRole) {
        const actor = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });

        if (!actor || actor.role !== "owner") {
            throw new Constants.ErrorResponse("Chỉ owner mới được phép thay đổi role", 403);
        }

        if (newRole === "owner") {
            throw new Constants.ErrorResponse("Không thể gán quyền owner", 400);
        }

        return prisma.groupMember.update({
            where: { userId_groupId: { userId, groupId } },
            data: { role: newRole }
        });
    }

    async deleteMember(userId, groupId) {
        const actor = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });

        if (!actor || (actor.role !== "owner" && actor.role !== "manager")) {
            throw new Constants.ErrorResponse("Không có quyền xóa thành viên", 403);
        }

        return prisma.groupMember.updateMany({
            where: { groupId, status: { not: "pending" } },
            data: { status: "declined" }
        });
    }

    async getGroupsByUser(userId) {
        // Lấy tất cả group mà user là thành viên
        const groups = await prisma.group.findMany({
            where: {
                groupMembers: {
                    some: { userId },
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

    async groupAuthorize(userId, groupId, roles = []) {
        //@todo
        return true;
    }
    async groupValidation() {
        //@todo
        return true;
    }
}

module.exports = new GroupsService();

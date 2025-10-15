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

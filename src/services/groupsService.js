const prisma = require("../config/database");
const { ErrorResponse, Constants } = require("../utils/constant");
//file này sẽ cần viết thêm DTO để lọc dữ liệu trả về
class GroupsService {
    /**
   * Kiểm tra xem group có hợp lệ hay không
   * - Không bị xóa
   * - Đang active
   * - Có subscription còn hạn
   */
    //luc nao cx chi co 1 plan tai 1 thoi diem thui
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
                        OR: [
                            { expireAt: null },
                            { expireAt: { gte: now } },
                        ],
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
                userId: true,
                role: true,
            },
        })
        if (!member) throw new ErrorResponse('Bạn đang không ở trong nhóm này', 400);
        // Nếu có danh sách roles được yêu cầu thì kiểm tra
        if (roles.length > 0 && !roles.includes(member.role)) {
            throw new ErrorResponse(`Chỉ ${roles} mới có thể thực hiện điều này`, 400);

        }

        return member;
    }
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
        const member = await this.groupMemberAuthorize(userId, groupId, Constants.GROUP_MEMBER_COMMON_ROLES);

        const isAdmin = Constants.GROUP_MEMBER_ADMIN_ROLES.includes(member.role);

        return await prisma.groupMember.findMany({
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
        const target = await this.getUserInGroup(targetId, groupId)
        if (actor.userId === targetId) {
            throw new ErrorResponse("Không thể cập nhật quyền của chính mình", 400);
        }
        if (target.role === 'owner') {
            throw new ErrorResponse("Không thể cập nhật quyền của owner", 400);
        }
        if (actor.role === 'manager' && target.role === 'manager') {
            throw new ErrorResponse("Bạn không thể cập nhật quyền của manager khác", 400);
        }
        return await prisma.groupMember.update({
            where: { userId_groupId: { userId: targetId, groupId } },
            data: { role: newRole }
        });
    }

    async deleteMember(userId, groupId, targetId) {
        const actor = await this.groupMemberAuthorize(userId, groupId, Constants.GROUP_MEMBER_OWNER_ROLES);
        const target = await this.getUserInGroup(targetId, groupId)
        if (actor.userId === targetId) {
            throw new ErrorResponse("Không thể xóa chính mình", 400);
        }
        if (target.role === 'owner') {
            throw new ErrorResponse("Không thể xóa owner", 400);
        }
        if (actor.role === 'manager' && target.role === 'manager') {
            throw new ErrorResponse("Bạn không thể xóa manager khác", 400);
        }
        return await prisma.groupMember.delete({
            where: { userId_groupId: { userId: targetId, groupId } },
        });
    }

    async getUserInGroup(userId, groupId) {
        return await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId: userId, groupId } },
        });
    }

    async getGroupsByUser(userId) {
        // Lấy tất cả group mà user là thành viên
        const groups = await prisma.group.findMany({
            where: {
                groupMembers: {
                    some: { userId, status: "accepted" },
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

    async getCurrentPlan(groupId) {
        const now = new Date();

        const subscription = await prisma.subscription.findFirst({
            where: {
                groupId,
                startedAt: { lte: now },
                OR: [
                    { expireAt: null },
                    { expireAt: { gte: now } },
                ],
            },
            include: {
                plans: true,
            },
        });

        if (!subscription) {
            throw new ErrorResponse("Nhóm chưa có gói đăng ký hợp lệ", 400);
        }

        return subscription.plans;
    }
    /**
     * Kiểm tra giới hạn số lượng thành viên của plan hiện tại
     */
    async checkMemberLimit(groupId) {
        const plan = await this.getCurrentPlan(groupId);

        const limits = plan.limits;
        const maxUsers = limits?.max_users ?? 1;

        const memberCount = await prisma.groupMember.count({
            where: {
                groupId,
                status: { in: ["accepted", "pending"] },
            },
        });

        if (memberCount >= maxUsers) {
            throw new ErrorResponse(
                `Nhóm đã đạt giới hạn tối đa ${maxUsers} thành viên.`,
                400
            );
        }
    }

    /**
     * Thêm thành viên mới với trạng thái pending
     */
    async inviteUserToGroup(groupId, userId) {
        // Kiểm tra tồn tại group
        const group = await this.groupValidation(groupId);

        // Kiểm tra giới hạn plan
        await this.checkMemberLimit(groupId);

        // Kiểm tra user đã trong nhóm chưa
        const existed = await prisma.groupMember.findFirst({
            where: { groupId, userId, status: { in: ["accepted", "pending"] } },
        });
        if (existed) throw new ErrorResponse("Người dùng đang ở trong nhóm hoặc đang đợi chấp thuận", 400);

        // Tạo mới
        const member = await prisma.groupMember.create({
            data: {
                groupId,
                userId,
                status: "pending",
                role: "member",
            },
        });

        return member;
    }

    async createPersonalFreeGroup(userId) {
        // Lấy thông tin user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, userName: true },
        });

        if (!user) {
            throw new ErrorResponse("Tài khoản không tồn tại", 400);
        }

        // Lấy plan có type = 'personal' và name = 'free'
        const plan = await prisma.plan.findFirst({
            where: {
                type: 'personal',
                name: 'free',
            },
        });

        if (!plan) {
            throw new ErrorResponse("Plan này không tồn tại trong hệ thống", 400);
        }

        // Tạo group mới cho user
        const group = await prisma.group.create({
            data: {
                name: `Workspace của tôi`,
                ownerId: user.id,
                isActive: true,
                groupMembers: {
                    create: {
                        userId: user.id,
                        role: 'owner',
                        status: 'accepted',
                    },
                },
                subscriptions: {
                    create: {
                        planId: plan.id,
                        startedAt: new Date(),
                    },
                },
            }
        });

        return group;
    }
}

module.exports = new GroupsService();

const prisma = require("../config/database");
const { ErrorResponse, Constants } = require("../utils/constant");

class groupDBService{
    async getGroupMembers(groupId) {
        return await prisma.group_members.findMany({
            where: {
                groupId:groupId
            },
            include: {
                users: { 
                    select: {
                        id: true,
                        email: true,
                        userName: true, 
                        avatarUrl: true,
                    },
                },
            },
        });
    }
    async getGroupById(groupId) {
        const group = await prisma.groups.findUnique({
            where: { id: groupId }
        })
        if (!group) {
            throw new ErrorResponse("Group not found", Constants.NOT_FOUND);
        }
        return group;
    }
    async getOwnerGroupById(groupId) {
        const group = await prisma.groups.findUnique({
            where: { id:  groupId },
            select: { creatorId: true }
        })
        if (!group) {
            throw new ErrorResponse("Group not found", Constants.NOT_FOUND);
        }
        return group;
    }
    async getMemberRole(memberId, groupId) {
        const member = await prisma.group_members.findUnique({
            where: { id: memberId, groupId: groupId },
        })
        if (!member) {
            throw new ErrorResponse("Member not found", Constants.NOT_FOUND);
        }
        return member;
    }
    async getTotalMembersOfGroup(groupId) {
        const cnt = await prisma.group_members.count({
            where: { groupId: groupId }
        });
        return cnt
    }
    async getMemberInformation(userId, groupId) {
        const member = await prisma.group_members.findUnique({
            where: {
                userId_groupId: { 
                    userId,
                    groupId
                },
            },
            include: {
                users: { 
                    select: {
                        id: true,
                        email: true,
                        userName: true,  
                        avatarUrl: true, 
                    },
                },
            },
        })
        if (!member) {
            throw new ErrorResponse("Member information not found", Constants.NOT_FOUND);
        }
        return member;
    }
    async getMemberships(userId) {
        return await prisma.group_members.findMany({
            where: {
                userId
            },
            include: {
                groups: true, 
            },
        });
    }
    async updateMemberRoleById(role, memberId, groupId) {
        return await prisma.group_members.update({
        where: {
            id: memberId,
            groupId
        },
        data: {
            role: role,
            updatedAt: new Date(),
        },
        });
    }
    async deleteMember(memberId, groupId) {
        return await prisma.group_members.delete({
            where: {
                id: memberId,
                groupId: groupId,
            }
        })
    }
    async deleteGroup(groupId) {
        return await prisma.groups.delete({
            where: { id: groupId },
        });
    }
}
module.exports = new groupDBService()

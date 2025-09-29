const { when } = require("joi");
const prisma = require("../config/database");
const { ErrorResponse, Constants } = require("../utils/constant");

class groupDBService{
    async createNewGroup(groups, creatorId){
        return await prisma.groups.create({
            data: {
                name: groups.name,
                slug: groups.slug,
                logoUrl: groups.logoUrl,
                creatorId: creatorId,
                phoneContact: groups.phoneContact,
                emailContact: groups.emailContact,
                countryCode: groups.countryCode,
                group_members: {
                create: {
                    userId: creatorId,
                    role: 'OWNER'
                },
                },
            },
            include: {
                users: { // creator
                select: {
                    id: true,
                    email: true,
                    userName: true,
                    avatarUrl: true,
                },
                },
                group_members: {
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
                },
                _count: {
                select: {
                    group_members: true,
                    channels: true,
                },
                },
            },
            });
    }
    async updateGroupInformation(groupId, data){
        return await prisma.groups.update({
            where: { id: groupId },
            data: {
                ...data
            }
        })
    }
    async getNameState(name){
        const checker = await prisma.groups.findFirst({
            where: { name: name },
            select: { name : true } 
        })
        if (!checker) return false
        return true
    }
    async getSlugState(slug){
        const checker = await prisma.groups.findUnique({
            where: { slug: slug },
            select: { slug : true } 
        })
        if (!checker) return false
        return true
    }
    async getSlugsRelate(slug){
        const slugs = await prisma.groups.findMany({
            where: { 
                slug: {
                    contains: slug,
                    mode: "insensitive"
            }},
            select:{
                slug: true
            }},
        )
        return slugs
    }
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
                userId:userId
            },
            include: {
                groups: true, 
            },
        });
    }
    async isMemberExisted(userId, groupId) {
        const member = await prisma.group_members.findUnique({
            where: {
                userId_groupId: {
                    userId,
                    groupId
                }
            }
        });
        return member;
    }
    async updateMemberRoleById(role, memberId, groupId) {
        return await prisma.group_members.update({
        where: {
            id: memberId,
            groupId
        },
        data: {
            role: role
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
    async addMemberToGroup(userId, groupId, role) {
        return await prisma.group_members.upsert({
            where: {
                userId_groupId: { userId, groupId }, // composite unique key
            },
            update: {}, // không cần update gì nếu đã tồn tại
            create: { userId, groupId, role },
            });
        }
}
module.exports = new groupDBService()

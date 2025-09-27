const prisma = require("../config/database");
const { catchAsync } = require("../utils/response")

class groupDBService{
    getGroupMembers = catchAsync(async (groupId) =>{
        return await prisma.group_members.findMany({
            where: {
                groupId
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
    })
    getGroupById = catchAsync (async (groupId) => {
        return await prisma.groups.findUnique({
            where: { id: groupId }
        })
    })
    getOwnerGroupById = catchAsync (async (groupId) => {
        return await prisma.groups.findUnique({
            where: { id:  groupId },
            select: { creatorId: true }
        })
    })
    getTotalMembersOfGroup = catchAsync(async (groupId) => {
        return await prisma.group_members.count({
            where: { groupId: groupId }
        });
    })  
    getMemberInformation = catchAsync(async (userId, groupId) =>{ 
        return await prisma.group_members.findUnique({
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
    })
    getMemberships = catchAsync(async (userId) =>{ 
        return await prisma.group_members.findMany({
            where: {
                userId:userId
            },
            include: {
                groups: true, 
            },
        });
    })
    updateMemberRoleById = catchAsync (async (role, memberId, groupId) => {
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
    })
    deleteMember = catchAsync (async (memberId, groupId) =>{
        return await prisma.group_members.delete({
            where: {
                id: memberId,
                groupId: groupId,
            }
        })
    })
    deleteGroup = catchAsync (async (groupId) => {
        return await prisma.groups.delete({
            where: { id: groupId },
        });
    })
}
module.exports = new groupDBService()
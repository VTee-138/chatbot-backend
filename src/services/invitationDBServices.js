const prisma = require('../config/database');
const { Constants, ErrorResponse } = require('../utils/constant');

class InvitationDBService {
    async createInvitation({ email, groupId, invitedById, role, token, expiresAt }) {
        return await prisma.invitations.create({
            data: {
                email,
                groupId,
                invitedById,
                role,
                token,
                expiresAt: new Date(expiresAt + 1000),
            },
        });
    }

    async getInvitationByToken(token) {
        const invitation = await prisma.invitations.findUnique({
            where: { token },
            include: {
                groups: true,
            }
        });
        if (!invitation) {
            throw new ErrorResponse('Invitation not found or has expired', Constants.NOT_FOUND);
        }
        return invitation;
    }

    async updateInvitationStatus(id, status) {
        return await prisma.invitations.update({
            where: { id },
            data: { status },
        });
    }
    async updateInvitationStatusByToken(token, status) {
        return await prisma.invitations.update({
            where: { token },
            data: { status },
        });
    }
    async getInvitationsByGroupId(groupId) {
        return await prisma.invitations.findMany({
            where: { groupId },
            include: {
                users: { // This is the inviter
                    select: {
                        id: true,
                        email: true,
                        userName: true,
                        avatarUrl: true,
                    }
                }
            }
        });
    }
    async getInvitationsByInvitorId(invitedById) {
        return await prisma.invitations.findMany({
            where: { invitedById },
            include: {
                users: { 
                    select: {
                        id: true,
                        email: true,
                        userName: true,
                        avatarUrl: true,
                    }
                }
            }
        });
    }

    async getInvitationById(id) {
        const invitation = await prisma.invitations.findUnique({
            where: { id },
        });
        if (!invitation) {
            throw new ErrorResponse('Invitation not found', Constants.NOT_FOUND);
        }
        return invitation;
    }
    async getInvitationByToken(token) {
        const invitation = await prisma.invitations.findUnique({
            where : {token}
        })
        if (!invitation) {
            throw new ErrorResponse('Invitation not found', Constants.NOT_FOUND);
        }
        return invitation;
    }
    async deleteInvitation(id) {
        return await prisma.invitations.delete({
            where: { id },
        });
    }
}

module.exports = new InvitationDBService();
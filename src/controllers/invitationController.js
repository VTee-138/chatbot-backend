const { successResponse, errorResponse, catchAsync } = require('../utils/response');
const { Constants, ErrorResponse } = require('../utils/constant');
const groupDBServices = require('../services/groupDBServices');
const invitationDBServices = require('../services/invitationDBServices');
const jwt = require('../utils/jwt');
const cookieHelper = require('../utils/cookieHelper');

const acceptInvitation = catchAsync(async (req, res, next) => {
    const { token } = req.body;
    try {
        // Get invitation by token
        const invitation = jwt.verifyToken(token, 'invitation_mail')
        const invitationFromDB = await invitationDBServices.getInvitationByToken(token)
        // Check if invitation is still pending and not expired
        if (['EXPIRED', 'DECLINE', 'ACCEPTED'].includes(invitationFromDB.status)) {
            return next(new ErrorResponse('Invitation is no longer valid', Constants.BAD_REQUEST));
        }
        if (invitation.expiresAt < new Date()) {
            await invitationDBServices.updateInvitationStatusByToken(token, 'EXPIRED');
            return next(new ErrorResponse('Invitation has expired', Constants.BAD_REQUEST));
        }
        
        // Add user to group
        await groupDBServices.addMemberToGroup(invitation.userId, invitation.id, invitation.role);
    
        // Update invitation status
        await invitationDBServices.updateInvitationStatusByToken(token, 'ACCEPTED');
    
        return successResponse(res, null, 'Invitation accepted successfully');
    } catch (error) {
        next(error)
    }
});

const declineInvitation = catchAsync(async (req, res, next) => {
    const { token } = req.body;

    try {
        // Get invitation by token
        const invitation = await invitationDBServices.getInvitationByToken(token);
    
        // Check if invitation is still pending
        if (invitation.status !== 'PENDING') {
            return next(new ErrorResponse('Invitation is no longer valid', Constants.BAD_REQUEST));
        }
    
        // Update invitation status
        await invitationDBServices.updateInvitationStatus(invitation.id, 'DECLINED');
    
        return successResponse(res, null, 'Invitation declined');
    } catch (error) {
        next(error)
    }
});

const getInvitations = catchAsync(async (req, res, next) => {
    const clientId = cookieHelper.getClientId(req)
    const allInvitations = [];
    try {
        const invitations = await invitationDBServices.getInvitationsByInvitorId(clientId);
        allInvitations.push(...invitations);
        return successResponse(res, allInvitations, 'Invitations retrieved successfully');
    } catch (error) {
        next(error)
    }
});

const revokeInvitation = catchAsync(async (req, res, next) => {
    // Tại vì id bên client mapping chuẩn tới id bên invitation trong db
    const { invitationId } = req.params;
    try {
        // Get invitation
        const invitation = await invitationDBServices.getInvitationById(invitationId);
        if (!['PENDING', 'DECLINED'].includes(invitation.status))
        return successResponse(res, "Need to remove this user not from invitation")
        // Delete invitation
        await invitationDBServices.deleteInvitation(invitationId);
        return successResponse(res, null, 'Invitation revoked successfully');
    } catch (error) {
        next(error)   
    }
    return successResponse(res, null, 'Invitation revoked successfully');
});


module.exports = {
    acceptInvitation,
    declineInvitation,
    getInvitations,
    revokeInvitation,
};
const GroupsService = require("../services/groupsService");
//để tạm đã sửa response theo successResponse sau buồn ngủ quá @@
class GroupController {
    async acceptInvitation(req, res, next) {
        try {
            const result = await GroupsService.acceptInvitation(req.user.id, req.body.groupId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async declineInvitation(req, res, next) {
        try {
            const result = await GroupsService.declineInvitation(req.user.id, req.body.groupId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async getMyInvitations(req, res, next) {
        try {
            const result = await GroupsService.getMyInvitations(req.user.id);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async getMyPendingInvitations(req, res, next) {
        try {
            const result = await GroupsService.getMyPendingInvitations(req.user.id);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async getGroupInformation(req, res, next) {
        try {
            const result = await GroupsService.getGroupInformation(req.params.id, req.user.id);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async getGroupMembers(req, res, next) {
        try {
            const result = await GroupsService.getGroupMembers(req.params.id, req.user.id);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async updateRole(req, res, next) {
        try {
            const { targetId, groupId, newRole } = req.body;
            const userId = req.user.id
            const result = await GroupsService.updateRole(userId, groupId, newRole, targetId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async deleteMember(req, res, next) {

        try {
            const { targetId, groupId } = req.body;
            const userId = req.user.id
            const result = await GroupsService.deleteMember(userId, groupId, targetId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
    async getMyGroups(req, res, next) {
        try {
            const userId = req.user.id;
            const groups = await GroupsService.getGroupsByUser(userId);
            res.json({ success: true, data: groups });
        } catch (error) {
            next(error)
        }
    }
}

module.exports = new GroupController();

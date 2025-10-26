const ChannelService = require('../services/channelService');

class ChannelController {
    static async getChannels(req, res) {
        try {
            const { groupId } = req.params;
            const userId = req.user.id; // middleware auth đã gán req.user

            const channels = await ChannelService.getChannelsByGroup(groupId, userId);
            res.json({ success: true, data: channels });
        } catch (error) {
            res.status(403).json({ success: false, message: error.message });
        }
    }
}

module.exports = ChannelController;

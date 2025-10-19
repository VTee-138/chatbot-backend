const ConversationService = require('../services/conversationService');

class ConversationController {
    async getConversations(req, res, next) {
        try {
            const { provider, page = 1, isRead } = req.query;

            const data = await ConversationService.getConversations({
                provider,
                page: parseInt(page),
                isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
            });

            res.json({
                success: true,
                data,
            });
        } catch (error) {
            next(error)
        }
    };
}

module.exports = new ConversationController()

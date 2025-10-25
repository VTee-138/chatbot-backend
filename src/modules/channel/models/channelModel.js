const prisma = require("../../../config/database")

class ConversationModel {
    async getFirstChannel(provider, providerId) {
        return await prisma.channel.findFirst({
            where: {
                provider,
                providerId
            },
        });
    }
    async getGroupChannel(groupId, provider, providerId) {
        return await prisma.channel.findFirst({
            where: {
                groupId,
                provider,
                providerId
            },
        });
    }
    async getAllChannelByProviderId(provider, providerId) {
        return await prisma.channel.findMany({
            where: {
                provider,
                providerId
            },
        });
    }
}

module.exports = new ConversationModel();
const prisma = require("../../../config/database")

class ConversationModel {
    async createConversation(provider, providerId, providerCustomerId, providerConversationId) {
        return await prisma.conversation.create({
            data: {
                provider,
                providerId,
                providerCustomerId,
                providerConversationId,
                customer: { create: {} },
            },
        });
    }
    async createZaloConversation(providerId, providerCustomerId) {
        return await this.createConversation('zalo', providerId, providerCustomerId, `zalo_user_id_${providerCustomerId}`);
    }
}

module.exports = new ConversationModel();
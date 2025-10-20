const prisma = require("../../../config/database")

class ConversationModel {
    async createConversation(provider, providerId, providerCustomerId, providerConversationId, lastMessageAt = new Date(), customerData = {}) {
        const { avatarUrl, fullName } = customerData;
        return await prisma.conversation.create({
            data: {
                provider,
                providerId,
                providerCustomerId,
                providerConversationId,
                customer: {
                    create: {
                        fullName,
                        avatarUrl,
                    }
                },
                lastMessageAt,
            },
        });
    }
    async createZaloConversation(providerId, providerCustomerId, lastMessageAt, customerData = {}) {
        //sau doi thanh DTO
        const { display_name, avatar } = customerData
        const transformCustomerData = { avatarUrl: avatar, fullName: display_name }
        return await this.createConversation('zalo', providerId, providerCustomerId, `zalo_user_id_${providerCustomerId}`, lastMessageAt, transformCustomerData);
    }
}

module.exports = new ConversationModel();
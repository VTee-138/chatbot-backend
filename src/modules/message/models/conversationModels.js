const prisma = require("../../../config/database")

class ConversationModel {
    async createConversation(provider, providerId, providerCustomerId, providerConversationId, lastMessageAt = new Date(), customerData = {}) {
        const { avatarUrl = null, fullName = null } = customerData;
        return await prisma.conversation.create({
            data: {
                provider,
                providerId,
                providerCustomerId,
                providerConversationId,
                customers: {
                    create: {
                        fullName,
                        avatarUrl,
                        groupId: 'bachdh1'
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
        console.log(transformCustomerData)
        return await this.createConversation('zalo', providerId, providerCustomerId, `zalo_user_id_${providerCustomerId}`, lastMessageAt, transformCustomerData);
    }
}

module.exports = new ConversationModel();
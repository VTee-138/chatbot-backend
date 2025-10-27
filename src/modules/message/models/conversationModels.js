const prisma = require("../../../config/database")

class ConversationModel {
    async createConversation(provider, providerId, providerCustomerId, providerConversationId, lastMessageAt = new Date(), customerData = {}, groupId) {
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
                        groupId,
                    }
                },
                lastMessageAt,
            },
        });
    }
    async createZaloConversation(providerId, providerCustomerId, lastMessageAt, customerData = {}, groupId) {
        //sau doi thanh DTO
        const { display_name, avatar } = customerData
        const transformCustomerData = { avatarUrl: avatar, fullName: display_name }
        return await this.createConversation('zalo', providerId, providerCustomerId, `zalo_user_id_${providerCustomerId}`, lastMessageAt, transformCustomerData, groupId);
    }

    async createCustomer(customerData = {}, groupId) {
        const { display_name, avatar } = customerData
        const transformCustomerData = { avatarUrl: avatar, fullName: display_name }
        const { avatarUrl = null, fullName = null } = transformCustomerData;
        return await prisma.customer.create({
            data: { fullName, avatarUrl, groupId },
            select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                groupId: true
            }
        })
    }
}

module.exports = new ConversationModel();
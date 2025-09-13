const prisma = require('../config/database')
class UserDBModel{
    async registerNewUser(user){
        return await prisma.user.create({data: user})
    }
    async updateVerifiedByEmail(email){
        return await prisma.user.update({
            where: {email: email},
            data: {emailVerifiedAt: new Date()}
        })
    }
    async updatePersonalInformation(){
        const {email, ...updateData} = user
        return await prisma.user.update({where: {email: email}, data: updateData})
    }
    async updatePassword(email, newPassword){
        await prisma.user.update({where: {email: email}, data: {passwordHash: newPassword, updatedAt: new Date()}})
    }
    async updatePasswordByID(id, newPassword){
        await prisma.user.update({
            where: { id: id },
            data: {
                passwordHash: newPassword,
                updatedAt: new Date(),
            },
        })
    }
    async updateUserLastLogin(id){
        await prisma.user.update({where: {id}, data:{lastLogin: new Date()}}) // Update LastLogin tại ngay thời điểm đó
    }
    async findUserByEmail(email){
        return await prisma.user.findUnique({where: {email}})
    }
    async createGoogleSSO(provider, providerId, userInput){
        let user = await prisma.user.findUnique({
            where: { email: 'sso:'+ userInput.email },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                firstName: userInput.given_name,
                lastName: userInput.family_name,
                email: 'sso:'+userInput.email, // Để phân biệt với user đăng ký tài khoản thường
                passwordHash: "google_password", // hoặc null / hằng số
                },
            });
        }
        await prisma.ssoAccount.create({
        data: {
            provider,
            providerId,
            userId: user.id,
        },
        });
        return user;

    }
    async createFacebookSSO(provider, providerId, userInput){
        const user = await prisma.user.create({
        data: {
            firstName: userInput.first_name,
            lastName: userInput.last_name,
            email: 'facebook_account', // cần get quyền để lấy được thông tin email hoặc phone đăng ký của người dùnge  
            passwordHash: "facebook_account"
        }})
        await prisma.ssoAccount.create({
                data: {
                    provider: provider,
                    providerId: providerId,
                    userId: user.id
                }
            })
        return user
    }
    async ssoLoginChecker(provider, providerId, userPayload) {
        let ssoAccount = await prisma.ssoAccount.findUnique({
            where: {
                provider_providerId: { provider, providerId },
            },
        });
        if (!ssoAccount) {
            if (provider === "google") {
            ssoAccount = await this.createGoogleSSO(provider, providerId, userPayload);
            } else if (provider === "facebook") {
            ssoAccount = await this.createFacebookSSO(provider, providerId, userPayload);
            } else {
            throw new Error(`Unsupported provider: ${provider}`);
            }
            return ssoAccount
        }

        // Lấy User tương ứng với SSO
        const user = await prisma.user.findUnique({
            where: { id: ssoAccount.userId },
        });
        return user
    }

    async deleteUserById(id){
        await prisma.user.delete({where: {id}})
    }
    async ssoSSOLinkingHandle(provider, providerId, userId){
        // dùng cho việc một tài khoản thường muốn liên kết ngoài với các tài khoản SSO
        const oldSSO = await prisma.ssoAccount.findUnique({where: {provider, providerId}})
        
        await this.deleteUserById(oldSSO.userId)
        await prisma.ssoAccount.update({where: {provider, providerId}, data: {userId: userId}})
    }
    // async overrideSSOLinkingHandle(provider, providerId) Khi người dùng muốn liên kết tài khoản với một tài khoản FB (Mà tài khoản FB đã tồn tại với một acc khác => Muốn override hay không)
}
module.exports = new UserDBModel()
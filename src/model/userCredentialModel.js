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
    async is2FAEnabled(email){
        const enabled = await prisma.user.findFirst({
            where: { email },
            select: { twoFactorEnabled: true}
        })
        return Boolean(enabled.twoFactorEnabled)
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
    async isSSOAccount(id){
        return await prisma.ssoAccount.findFirst({where: { userId: id }, select: { provider: true }})
    }
    async findUserById(id){
        return await prisma.user.findUnique({where: {id}})
    }
    async findSSOUser(provider, providerId){
        const ssoUser = await prisma.ssoAccount.findFirst({
            where: { provider, providerId},
            select: { userId : true }
        })
        if (!ssoUser) return null
        return await this.findUserById(ssoUser.userId)
    }
    async updateSSOAccount(provider, providerId, userInput) {
        const user = this.findSSOUser(provider, providerId)
        if (!user) return null
        return await prisma.user.update({
            where: { id : user.id},
            data: {
                fullName: userInput.fullName,
                phoneNumber: userInput.phoneNumber
            }
        })
    }
    async createSSOAccount(provider, providerId, userInput){
        const newUser = await prisma.user.create({
            data: { 
                fullName: userInput.fullName,
                email: provider=='google'? userInput.email: `${providerId}@facebook.com`,   
            }   
        })
        return await prisma.ssoAccount.create({
            data: {
                provider,
                providerUserId: providerId,
                userId: newUser.id
            }
        })
    }
    async createNewDeviceSession(userId, ipAddress, userAgent ){

    }
    async updateTokenSession(userId, refreshTokenHash){ 
        // return await prisma.sessions.upsert({
        //     where: { userId }
        //     update: {
        //         updatedAt : new Date()
        //     }
        //     create
        // })
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
 }
module.exports = new UserDBModel()
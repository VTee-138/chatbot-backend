const prisma = require('../config/database')
class UserDBModel{
    async updateVerifiedByEmail(email){
        return await prisma.user.update({
            where: {email: email.toLowerCase()},
            data: {emailVerifiedAt: new Date()}
        })
    }
    async get2FAStatus(userName){
        const enabled = await prisma.user.findFirst({
            where: { userName },
            select: { twoFactorEnabled: true}
        })
        return Boolean(enabled.twoFactorEnabled)
    }
    async updatePersonalInformation(){
        const {email, ...updateData} = user
        return await prisma.user.update({where: {email: email}, data: updateData})
    }
    async updatePassword(email, newPassword){
        email = email.toLowerCase()
        return await prisma.user.update({where: {email: email}, data: {passwordHash: newPassword}})
    }
    async updatePasswordByID(id, newPassword){
        await prisma.user.update({
            where: { id: id },
            data: {
                passwordHash: newPassword
            },
        })
    }
    async updateUserLastLogin(id){
        await prisma.user.update({where: {id}, data:{lastLogin: new Date()}}) // Update LastLogin tại ngay thời điểm đó
    }
    async updateSSOAccount(provider, providerId, userInput) {
        const user = this.findUserBySSO(provider, providerId)
        if (!user) return null
        return await prisma.user.update({
            where: { id : user.id},
            data: {
                userName: userInput.userName,
                phoneNumber: userInput.phoneNumber
            }
        })
    }
    async findSSOUserById(id){
        const ssoUser = await prisma.ssoAccount.findMany({
            where:{ userId: id},
            select: { providerId : true, provider: true}
        })
        if (!ssoUser) return null
        return ssoUser
    }
    async findDefinedSSOUserById(provider, id){
        const ssoUser = await prisma.ssoAccount.findFirst({
            where:{ provider ,userId: id},
            select: { providerId : true}
        })
        if (!ssoUser) return null
        return ssoUser.providerId
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
    
    async findUserBySSO(provider, providerId){
        const ssoUser = await prisma.ssoAccount.findFirst({
            where: { provider, providerId},
            select: { userId : true }
        })
        if (!ssoUser) return null
        return await this.findUserById(ssoUser.userId)
    }
    async findUserByEmail(email){
        email = email.toLowerCase()
        return await prisma.user.findUnique({where: {email}})
    }
    async findAccountWithUserName(userName){
        return await prisma.user.findUnique({where: { userName }})
    }
    async isSSOAccount(id){
        return await prisma.ssoAccount.findFirst({where: { userId: id }, select: { provider: true }})
    }
    async findUserById(id){
        return await prisma.user.findUnique({where: {id}})
    }
    async registerNewUser(user){
        if(user.email) user.email = user.email.toLowerCase()
        return await prisma.user.upsert({
            where: {
                email: user.email
            },
            update: { ...user},
            create: { ...user}
        }
        )
    }
    async createSSOAccount(provider, providerId, userInput){
        if(userInput.email) userInput.email = userInput.email.toLowerCase()
        const newUser = await prisma.user.create({
            data: { 
                userName: userInput.userName,
                email: provider=='google'? userInput.email: `${providerId}@facebook.com`,
                emailVerifiedAt: new Date()
            }   
        })
        await prisma.ssoAccount.create({
            data: {
                provider,
                providerId: providerId,
                userId: newUser.id
            }
        })
        return newUser
    }
    async enable2FAMode(userName, secret, backupCodes){
        try {
            return await prisma.user.update({
                where: {userName},
                data: {
                    twoFactorEnabled: true,
                    twoFactorSecret: secret,
                    twoFactorBackupCodes: backupCodes
                }
            })
        } catch (error) {
            throw error 
        }
    }
    async disable2FAMode(userName){
        try {
            return await prisma.user.update({
                where: { userName},
                data: {
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                    twoFactorBackupCodes: []
                }
            })
        } catch (error) {
            throw error
        }
    }
    async update2FASecret(userName, secret){
        try {
            return await prisma.user.update({
                where: { userName},
                data: {
                    twoFactorSecret: secret
                }
            })
        } catch (error) {
            throw error
        }
    }
    async update2FACodes(id, backupCodes){
        try {
            return await prisma.user.update({
                where: { id },
                data: {
                    twoFactorBackupCodes: backupCodes
                }
            })
        } catch (error) {
            throw error
        }
    }
    async createNewDeviceSession(userId, ipAddress, userAgent ){

    }
    async deleteUserById(id){
        await prisma.user.delete({where: {id}})
    }
    async handleSSOAccount(provider, providerId, userInput){
        
    }
    async ssoLinkingHandle(provider, providerId, userId){
        // dùng cho việc một tài khoản thường muốn liên kết ngoài với các tài khoản SSO
        const oldSSO = await prisma.ssoAccount.findUnique({where: {provider, providerId}})
        
        await this.deleteUserById(oldSSO.userId)
        await prisma.ssoAccount.update({where: {provider, providerId}, data: {userId: userId}})
    }
    getProfile(data, role){
        if (role === 'USER')
        return {
            id: data.id,
            email: data.email,
            name: data.userName,
            phoneNumber: data.phoneNumber,
            avatarUrl: data.avatarUrl,
            twoFactorEnabled: data.twoFactorEnabled,
            createdAt: data.createdAt
        }
        else return // chưa biết hướng
    }
    
 }
module.exports = new UserDBModel()
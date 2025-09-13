const { OAuth2Client } = require("google-auth-library");
const config = require("../config");
const { default: axios } = require("axios");

class ssoService{
    constructor() {
        // Initialize any properties if needed
        this.googleClientId = config.GOOGLE_CLIENT_ID;
        this.facebookAppId = config.FACEBOOK_APP_ID;
        this.facebookAppSecret = config.FACEBOOK_APP_SECRET
    }
    getFBPackage(idToken){
        const appAccessToken = `${this.facebookAppId}|${this.facebookAppSecret}`
        const url = `https://graph.facebook.com/debug_token?input_token=${idToken}&access_token=${appAccessToken}`
        return { appAccessToken, url }
    }
    async getFBProfileData(userId, idToken){
        try {
            const profileUrl = `https://graph.facebook.com/${userId}?fields=id,first_name,last_name,email&access_token=${idToken}`;
            return await axios.get(profileUrl);
        } catch (error) {
            throw error
        }
    }
    async verifyGoogleToken(idToken){
        try {
            const client = new OAuth2Client(this.googleClientId)
            const ticket = await client.verifyIdToken({
                idToken,
                audience: this.googleClientId
            })
            const payload = ticket.getPayload() 
            return payload  
        } catch (error) {
            throw error
        }
    }
    async verifyFacebookToken(idToken){
        try {
            const package = this.getFBPackage(idToken)
            const response = await axios.get(package.url)
    
            const { data } = response.data
            if (!data.is_valid || data.app_id !== this.facebookAppId) {
                throw new constant.ErrorResponse("Invalid Facebook Token", constant.BAD_REQUEST);
            }
            return (await this.getFBProfileData()).data
        } catch (error) {
            throw error
        }
    }
}
module.exports = new ssoService
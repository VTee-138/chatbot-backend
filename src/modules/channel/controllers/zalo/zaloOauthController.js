const prisma = require('../../../../config/database')
const axios = require('axios');
const PKCEUtility = require('../../../../utils/pkceUtils');
const { ErrorResponse, Constants } = require('../../../../utils/constant');
const ZaloOauthService = require('../../services/zalo/zaloOauthService');
const zaloAPIService = require('../../services/zalo/zaloAPIService');
class ZaloOauthController {
    async initiateZaloOAuth(req, res, next) {
        try {
            const { groupId } = req.body;
            // const userId = req.user.id;

            // @todo: check permission xem user có quyền gì trong group này không

            // Generate state and PKCE codeVerifier
            const state = PKCEUtility.genState();
            const codeVerifier = PKCEUtility.generateCodeVerifier();
            const codeChallenge = PKCEUtility.generateCodeChallenge(codeVerifier);

            // Store PKCE context in Redis/memory
            await PKCEUtility.storeCodeVerifier(state, JSON.stringify({ codeVerifier, groupId }));

            // Build Zalo OAuth URL
            const redirectUri = process.env.NODE_ENV === 'production'
                ? process.env.ZALO_REDIRECT_URI_PROD
                : process.env.ZALO_REDIRECT_URI_DEV;

            const authUrl = new URL('https://oauth.zaloapp.com/v4/oa/permission');
            authUrl.searchParams.set('app_id', process.env.ZALO_APP_ID);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');

            return res.status(302).json({
                success: true,
                data: {
                    redirectURL: authUrl.toString(),
                }
            });
        } catch (error) {
            next(error)
        }
    }
    async handleZaloCallback(req, res, next) {
        try {
            const { code, state, oa_id } = req.query;
            if (!code || !state) {
                throw new ErrorResponse('Invalid or expired state', Constants.BAD_REQUEST)
            }
            const channelRecord = await ZaloOauthService.createZaloChannel(code, state, oa_id);
            await zaloAPIService.syncZaloConversations(channelRecord.accessToken, channelRecord.providerId)
            return res.status(200).json({
                success: true,
                data: 'success'
            });

        } catch (error) {
            next(error)
        }
    }
}
module.exports = new ZaloOauthController()
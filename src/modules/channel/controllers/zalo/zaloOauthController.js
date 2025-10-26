const { ErrorResponse, Constants } = require('../../../../utils/constant');
const ZaloOauthService = require('../../services/zalo/zaloOauthService');
const zaloAPIService = require('../../services/zalo/zaloAPIService');
class ZaloOauthController {
    async initiateZaloOAuth(req, res, next) {
        try {
            const { groupId } = req.body;
            const userId = req.user.id;
            // 1️⃣ Kiểm tra quyền
            await ZaloOauthService.ensureUserHasPermission(userId, groupId);
            // 2️⃣ Kiểm tra giới hạn channel
            await ZaloOauthService.ensureGroupCanAddChannel(groupId);
            // 3️⃣ Tạo link OAuth Zalo
            const redirectURL = await ZaloOauthService.generateZaloOAuthURL(groupId);
            return res.status(200).json({
                success: true,
                data: {
                    redirectURL
                }
            });
        } catch (error) {
            next(error)
        }
    }
    async handleZaloCallback(req, res, next) {
        try {
            const { code, state, oa_id } = req.query;
            if (!code || !state || !oa_id) {
                throw new ErrorResponse('Invalid or expired state', Constants.BAD_REQUEST)
            }
            const channelRecord = await ZaloOauthService.createZaloChannel(code, state, oa_id);
            zaloAPIService.syncZaloConversations(channelRecord.accessToken, channelRecord.providerId)
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
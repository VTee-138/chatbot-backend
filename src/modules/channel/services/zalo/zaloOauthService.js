// services/zaloChannelService.js
const axios = require('axios');
const prisma = require('../../../../config/database')
const RedisUtility = require("../../../../utils/redisUtils");
const DatetimeUtility = require('../../../../utils/datetimeUtils');
const { ErrorResponse, Constants } = require('../../../../utils/constant');
const PKCEUtility = require('../../../../utils/pkceUtils');

class ZaloOauthService {
    /**
     * exchange authorization code -> access/refresh token (lần lấy token đầu)
     * params:
     *   - channelRow: prisma channel record (must have providerId etc)
     *   - code: authorization code from Zalo
     *   - appId, secretKey: app credentials
     */



    //@todo ve sau se tach ham nay ra 1 service channel de upsert rieng
    async exchangeCodeForToken({ code, appId, oa_id, groupId, codeVerifier }) {

        const url = Constants.ZALO.GET_TOKEN_URL;
        const params = new URLSearchParams();
        params.append('app_id', appId);
        params.append('code_verifier', codeVerifier);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);

        const res = await axios.post(url, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10_000
        });

        const data = res.data;
        if (data.error) {
            const msg = `Zalo exchange error: ${data.error} ${data.error_description || ''}`;
            throw new Error(msg);
        }

        // Zalo returns access_token, refresh_token, expires_in (seconds), oa_id...
        const now = new Date();
        const expireAt = DatetimeUtility.addSeconds(now, data.expires_in || 3600);
        const oaName = await this.getOaInformation(data.access_token, oa_id)


        const updated = await prisma.channel.upsert({
            where: {
                // unique constraint
                provider_providerId_groupId: {
                    provider: 'zalo',
                    providerId: oa_id,
                    groupId: groupId
                }
            },
            update: {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                updatedAt: new Date(),
                expireAt,
            },
            create: {
                name: oaName,
                provider: 'zalo',
                providerId: oa_id,
                groupId,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expireAt,
            }
        });

        // Optionally you may persist expiresAt in a separate table or add field `tokenExpiresAt` to Channel.
        // For this sample we assume updatedAt + expected TTL will be checked.

        return updated;
    }

    /**
     * refresh token for channel (one instance performs refresh)
     * - channelRow: prisma channel record (should include refreshToken)
     * - appId, secretKey
     */
    async refreshChannelToken({ channelId, appId, secretKey }) {
        const channel = await prisma.channel.findUnique({ where: { id: channelId } });
        if (!channel) throw new ErrorResponse('Kênh tin nhắn không tồn tại', Constants.NOT_FOUND);

        if (!channel.refreshToken) {
            throw new ErrorResponse(`Vui lòng thêm lại kênh ${channel?.name}`, Constants.BAD_REQUEST)
        }

        const url = Constants.ZALO.GET_TOKEN_URL;
        const params = new URLSearchParams();
        params.append('app_id', appId);
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', channel.refreshToken);
        console.log(params.toString())
        const resp = await axios.post(url, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                "secret_key": secretKey
            },
            timeout: 10_000
        });

        const data = resp.data;
        if (data.error) {
            const msg = `Zalo refresh error: ${data.error} ${data.error_description || ''}`;
            throw new Error(msg);
        }

        const now = new Date();
        const expireAt = DatetimeUtility.addSeconds(now, data.expires_in || 3600);

        const updated = await prisma.channel.update({
            where: { id: channelId },
            data: {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                updatedAt: new Date(),
                expireAt
            }
        });

        return updated;
    }

    /**
     * getValidAccessToken
     * - đảm bảo trả về access token hợp lệ (refreshed nếu cần)
     * - sử dụng redis lock để tránh nhiều instance refresh cùng lúc
     *
     * strategy:
     * 1) đọc DB (channel)
     * 2) nếu token còn hiệu lực -> return
     * 3) nếu token hết hạn -> cố acquireLock
     *    - nếu acquire thành công -> thực hiện refreshChannelToken -> update DB -> release lock -> return
     *    - nếu không -> poll DB (Constants.POLL_MAX_ATTEMPTS lần) để đợi token mới từ instance khác
     *               -> nếu sau poll chưa có -> cố acquire lock lần 2 -> nếu vẫn fail -> throw error
     */
    async getValidAccessToken(channelId, appId, secretKey) {
        // 1) read DB
        let channel = await prisma.channel.findUnique({ where: { id: channelId } });
        if (!channel) throw new ErrorResponse('Kênh tin nhắn không tồn tại', Constants.NOT_FOUND);

        const now = new Date();
        let tokenIsValid = false;
        if (channel.accessToken) {
            tokenIsValid = now < channel?.expireAt;
        }
        if (!channel?.refreshToken) {
            throw new ErrorResponse(`Vui lòng thêm lại kênh ${channel?.name}`, Constants.BAD_REQUEST)
        }
        if (tokenIsValid) return channel.accessToken;
        console.log('token invalid-- starting refresh')
        // token expired or not present -> try to refresh with distributed lock
        const lockKey = `${Constants.LOCK_KEY_PREFIX}${channelId}`;
        let lockValue = await RedisUtility.acquireLock(lockKey, Constants.LOCK_TTL_MS);
        if (lockValue) {
            // we acquired lock -> perform refresh
            try {
                const updated = await this.refreshChannelToken({ channelId, appId, secretKey });
                console.log("refresh thanhf cong")
                return updated.accessToken;
            } catch (err) {
                // If refresh failed, release lock and propagate error.
                // If refresh returns a specific error that indicates reauth needed, propagate up.
                throw err;
            } finally {
                await RedisUtility.releaseLock(lockKey, lockValue);
            }
        } else {
            // someone else is refreshing -> poll DB waiting for token updated
            for (let i = 0; i < Constants.POLL_MAX_ATTEMPTS; i++) {
                await new Promise(r => setTimeout(r, Constants.POLL_INTERVAL_MS));
                const rec = await prisma.channel.findUnique({ where: { id: channelId } });
                if (!rec) throw new ErrorResponse("kênh không tồn tại", Constants.NOT_FOUND);

                // check if updated recently (someone refreshed)
                if (rec.updatedAt && (new Date() - rec.updatedAt) / 1000 < Constants.LOCK_TTL_MS / 1000 + 2) {
                    if (rec.accessToken) return rec.accessToken;
                }
            }

            // After polling, try acquire lock again (maybe original holder failed)
            lockValue = await RedisUtility.acquireLock(lockKey, Constants.LOCK_TTL_MS);
            if (lockValue) {
                try {
                    const updated = await this.refreshChannelToken({ channelId, appId, secretKey });
                    return updated.accessToken;
                } catch (err) {
                    throw err;
                } finally {
                    await RedisUtility.releaseLock(lockKey, lockValue);
                }
            } else {
                // give up after retries
                throw new ErrorResponse('Quyền truy cập đã hết hạn, vui lòng cấp lại quyền truy cập cho kênh zalo', Constants.BAD_REQUEST);
            }
        }
    }

    async getOaInformation(access_token, oa_id) {
        const oaInfoResponse = await axios.get(
            'https://openapi.zalo.me/v2.0/oa/getoa',
            { headers: { 'access_token': access_token } }
        );
        const oaInfo = oaInfoResponse.data.data;
        return oaInfo.name || `Zalo OA ${oa_id}`;
    }
    async createZaloChannel(code, state, oa_id) {
        // Retrieve PKCE context
        const pkceContext = await PKCEUtility.getCodeVerifier(state);
        if (!pkceContext) {
            throw new ErrorResponse('Invalid or expired state', Constants.BAD_REQUEST)
        }
        const { codeVerifier, groupId } = pkceContext;

        // Get Zalo app credentials (could depend on environment)
        const appId = process.env.ZALO_APP_ID;

        const channelRecord = await this.exchangeCodeForToken({
            code,
            appId,
            oa_id,
            groupId,
            codeVerifier
        });

        // Cleanup PKCE
        await PKCEUtility.removeCodeVerifier(state);
        return channelRecord;
    }
    async ensureUserHasPermission(userId, groupId) {
        const member = await prisma.groupMember.findFirst({
            where: { userId, groupId, status: "accepted" },
            select: { role: true },
        });

        if (!member) throw new ErrorResponse("Bạn không thuộc nhóm này", 400);

        if (!Constants.GROUP_MEMBER_OWNER_ROLES.includes(member.role)) {
            throw new ErrorResponse("Bạn không có quyền thực hiện thao tác này", 403);
        }
    }
    async ensureGroupCanAddChannel(groupId) {
        const now = new Date();

        const subscription = await prisma.subscription.findFirst({
            where: { groupId, startedAt: { lte: now }, expireAt: { gte: now } },
            include: { plans: true },
        });

        if (!subscription) {
            throw new ErrorResponse("Nhóm chưa có gói đăng ký hợp lệ", 400);
        }

        const plan = subscription.plans;
        const limits = plan.limits;
        const maxChannels = limits?.max_channels ?? 1;

        const channelCount = await prisma.channel.count({ where: { groupId } });

        if (channelCount >= maxChannels) {
            throw new ErrorResponse(
                `Nhóm đã đạt giới hạn tối đa ${maxChannels} kênh.`,
                400
            );
        }
    }
    async generateZaloOAuthURL(groupId) {
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

        return authUrl.toString();
    }
}


module.exports = new ZaloOauthService()

const zaloAPIService = require("./src/modules/channel/services/zalo/zaloAPIService");
const zaloOauthService = require("./src/modules/channel/services/zalo/zaloOauthService");

async function main() {
    try {
        let accessToken = await zaloOauthService.getValidAccessToken('bachdh1', '2543059390267371532', 'V3MJIUZqbxYKsk722TqK')
        console.log(accessToken)
        await zaloAPIService.syncZaloConversations(accessToken, '3592353763697768582')
    } catch (error) {
        console.log(error)
    }
}
main();

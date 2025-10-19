const ZaloApiService = require('../../services/zalo/zaloAPIService');

class ZaloAPIController {
    async getRecentUsers(req, res) {
        try {
            const accessToken = req.headers['access_token'];
            if (!accessToken)
                return res.status(400).json({ error: 'Missing access_token' });

            const users = await ZaloApiService.getAllUsers(accessToken);
            res.json({ total: users.length, users });
        } catch (err) {
            console.error('❌ Zalo get users error:', err.message);
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new ZaloAPIController();

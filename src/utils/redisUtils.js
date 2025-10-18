const redis = require("../config/redis")
const { generateRandomString } = require('./crypto');
// Helper: safe acquire lock with value and TTL
class RedisUtility {
    static async acquireLock(lockKey, ttl = LOCK_TTL_MS) {
        const value = generateRandomString();
        const ok = await redis.set(lockKey, value, 'PX', ttl, 'NX');
        if (ok === 'OK') return value;
        return null;
    }
    // Helper: safe release lock only if value matches (avoid deleting lock của instance khác)
    static async releaseLock(lockKey, value) {
        // Lua script: if redis.get(key) == value then del key end
        const lua = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
        try {
            await redis.eval(lua, 1, lockKey, value);
        } catch (error) {
            throw error
        }
    }
}

module.exports = RedisUtility

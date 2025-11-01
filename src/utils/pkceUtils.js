// utils/pkce.js
const crypto = require('crypto');
const memoryStore = require("../config/memoryStore")
const redis = require("../config/redis")

class PKCEUtility {
    static CODE_VERIFIER_TTL = 5 * 60;
    static genState() {
        return crypto.randomBytes(16).toString('hex');
    }
    static base64url(buffer) {
        return buffer.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Generate a cryptographically secure code_verifier (RFC 7636)
     * - length between 43 and 128 characters recommended. We'll use 64 bytes -> 86+ chars in base64url.
     */
    static generateCodeVerifier() {
        // 32 bytes -> base64url length ~43; use 48 bytes for safety
        const buf = crypto.randomBytes(48);
        return this.base64url(buf);
    }

    /**
     * Generate code_challenge using SHA256(code_verifier) then base64url encode
     */
    static generateCodeChallenge(codeVerifier) {
        const hash = crypto.createHash('sha256').update(codeVerifier).digest();
        return this.base64url(hash);
    }
    static async storeCodeVerifier(state, data) {
        try {
            const value = typeof data === 'string' ? data : JSON.stringify(data);
            await redis.setex(`oauth:pkce:${state}`, this.CODE_VERIFIER_TTL, value);
        } catch (err) {
            // Redis not available -> fallback to memory (not recommended for multi-instance)
            const value = typeof data === 'string' ? data : JSON.stringify(data);
            memoryStore.set(state, value);
            // schedule removal
            setTimeout(() => memoryStore.delete(state), this.CODE_VERIFIER_TTL * 1000 + 1000);
        }
    }

    /**
     * getCodeVerifier(state)
     */
    static async getCodeVerifier(state) {
        try {
            const raw = await redis.get(`oauth:pkce:${state}`);
            return raw ? JSON.parse(raw) : null;

        } catch (err) {
            // ignore redis error, use memory fallback
        }
        const mem = memoryStore.get(state);
        return mem ? JSON.parse(mem) : null;
    }

    /**
     * removeCodeVerifier(state)
     */
    static async removeCodeVerifier(state) {
        try {
            await redis.del(`oauth:pkce:${state}`);
        } catch (err) {
            // ignore
        }
        memoryStore.delete(state);
    }
}

module.exports = PKCEUtility

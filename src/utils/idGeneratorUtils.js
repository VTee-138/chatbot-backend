import FlakeId from 'flake-idgen';
import baseX from 'base-x';

// Bảng ký tự Base62 (0-9, a-z, A-Z)
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const base62 = baseX(BASE62);

export function createUniqueId(worker = 1, datacenter = 1) {
    // Tạo generator Snowflake (workerId = 1)
    const flakeIdGen = new FlakeId({ worker: worker, datacenter: datacenter });
    const buffer = flakeIdGen.next();    // Buffer 8 byte
    return base62.encode(buffer);        // Encode sang Base62
}

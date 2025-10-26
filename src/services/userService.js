
const prisma = require('../config/database');
const { ErrorResponse } = require('../utils/constant');
class UserService {
    async searchUsers({ keyword, page = 1 }) {
        if (!keyword) {
            throw new ErrorResponse('Thiếu tham số tìm kiếm', 400);
        }

        const limit = 10;
        const skip = (page - 1) * limit;

        const where = {
            OR: [
                { userName: { contains: keyword, mode: 'insensitive' } },
                { email: { contains: keyword, mode: 'insensitive' } },
            ],
        };

        const users = await prisma.user.findMany({
            where,
            skip,
            take: limit,
            select: {
                id: true,
                userName: true,
                email: true,
                avatarUrl: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        const total = await prisma.user.count({ where });

        return {
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

module.exports = new UserService();
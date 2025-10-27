const prisma = require("../config/database");

class customersService {
    async createNewCustomer(fullName, phoneNumber, email, gender, groupId) {
        const newCustomer = await prisma.customer.create({
            data: { fullName, phoneNumber, email, gender, groupId },
            select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                email: true,
                gender: true,
                groupId: true
            }
        })
        return newCustomer;
    }

    //hàm này chưa phân trang
    async getAllCustomers(groupId, page) {
        const limit = 10;
        const skip = (page - 1) * limit;

        // Tổng số khách hàng thuộc group
        const totalItem = await prisma.customer.count({
            where: { groupId },
        });

        // Lấy danh sách khách hàng có phân trang
        const customers = await prisma.customer.findMany({
            where: { groupId },
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc', // có thể đổi sang 'asc' nếu muốn
            },
        });

        const totalPage = Math.ceil(totalItem / limit);

        return {
            customers,
            page,
            limit,
            totalPage,
            totalItem,
        };
    }

    async getCustomerById(id) {
        const data = await prisma.customer.findUnique({
            where: id,
            select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                email: true,
                gender: true
            }
        })
        return data;
    }

    async updateCustomer(id, data) {
        const updateUser = await prisma.customer.update({
            where: id,
            data,
            select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                email: true,
                address: true,
                dateOfBirth: true,
                gender: true,
                groupId: true
            }
        })
        return updateUser;
    }

    async deleteCustomer(id) {
        await prisma.customer.delete({
            where: id
        })
    }

}

module.exports = new customersService();
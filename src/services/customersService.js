const { dmmfToRuntimeDataModel } = require("@prisma/client/runtime/library");
const prisma = require("../config/database");
const { deleteCustomer } = require("../controllers/customersController");

class customersService {
    async createNewCustomer(fullName, phoneNumber, email, gender, groupId) {
        const newCustomer = await prisma.customer.create({
            data: {fullName, phoneNumber, email, gender, groupId},
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
    
    async getAllCustomers() {
        return await prisma.customer.findMany();
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